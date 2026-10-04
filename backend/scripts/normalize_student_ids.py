"""Report and normalize student IDs in alumni_profiles (one-off, run by hand).

Get Mark's OK before running with --apply against any real database.

What it does:
  * Compares every profile's student_id on its normalized form (trimmed and
    uppercased), the same form the app saves and checks.
  * Default (dry run): prints a summary only. Nothing is written.
  * --apply: rewrites student_id to its normalized form ONLY for profiles
    whose normalized value doesn't collide with another profile.
  * Any group of profiles that would share a student ID after normalization is
    skipped and listed (student ID and profile ids only) for manual resolution.
  * It never deletes or merges profiles.

Usage, from backend/ with the app's MongoDB settings in the environment:
    python -m scripts.normalize_student_ids          # dry run
    python -m scripts.normalize_student_ids --apply  # after Mark's OK
"""
from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass, field
from typing import Any, Iterable

from app.db.student_ids import find_duplicate_groups, normalize_student_id


@dataclass
class Plan:
    updates: list[tuple[Any, str, str]] = field(default_factory=list)  # (_id, old, new)
    collisions: dict[str, list[str]] = field(default_factory=dict)  # normalized id -> profile ids
    already_normalized: int = 0
    skipped_non_string: int = 0


def build_plan(docs: Iterable[dict[str, Any]]) -> Plan:
    """Decide what --apply would change. Pure: no database access."""
    docs = list(docs)
    plan = Plan(collisions=find_duplicate_groups(docs))
    colliding = {pid for ids in plan.collisions.values() for pid in ids}
    for doc in docs:
        value = doc.get("student_id")
        if value is None:
            continue
        if not isinstance(value, str):
            plan.skipped_non_string += 1
            continue
        if str(doc.get("_id")) in colliding:
            continue
        normalized = normalize_student_id(value)
        if normalized == value:
            plan.already_normalized += 1
        else:
            plan.updates.append((doc.get("_id"), value, normalized))
    return plan


def format_summary(plan: Plan, applied: bool) -> str:
    lines = [
        "Student ID normalization (" + ("APPLIED" if applied else "dry run, nothing written") + ")",
        f"  already normalized: {plan.already_normalized}",
        f"  {'normalized' if applied else 'would normalize'}: {len(plan.updates)}",
        f"  non-string values left alone: {plan.skipped_non_string}",
        f"  colliding groups skipped for manual resolution: {len(plan.collisions)}",
    ]
    for student_id, ids in sorted(plan.collisions.items()):
        lines.append(f"    {student_id}: profiles {', '.join(ids)}")
    if not applied and plan.updates:
        lines.append("Run again with --apply to write the changes (get Mark's OK first).")
    return "\n".join(lines)


async def run(profiles: Any, apply: bool) -> Plan:
    docs = [doc async for doc in profiles.find({"student_id": {"$exists": True}}, {"student_id": 1})]
    plan = build_plan(docs)
    if apply:
        for profile_id, old, new in plan.updates:
            # Only touch the document if it still holds the value we planned from.
            await profiles.update_one({"_id": profile_id, "student_id": old}, {"$set": {"student_id": new}})
    return plan


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="write normalized values (non-colliding only)")
    args = parser.parse_args(argv)

    from app.db.collections import alumni_profiles_collection
    from app.db.session import get_motor_client

    plan = asyncio.run(run(alumni_profiles_collection(get_motor_client()), args.apply))
    print(format_summary(plan, args.apply))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

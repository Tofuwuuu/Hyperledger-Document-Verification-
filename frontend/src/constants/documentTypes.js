const DOCUMENT_TYPES = [
  { id: 'diploma', label: 'Diploma' },
  { id: 'transcript_of_records', label: 'Transcript of Records' },
  { id: 'certificate', label: 'Certificate' },
  { id: 'id_card', label: 'ID Card' },
  { id: 'good_moral_certificate', label: 'Good Moral Certificate' },
  { id: 'general_certification', label: 'General Certification' },
  { id: 'enrollment_certificate', label: 'Enrollment Certificate' },
  { id: 'honorable_dismissal', label: 'Honorable Dismissal' },
  { id: 'authentication_letter', label: 'Authentication Letter' },
  { id: 'other', label: 'Other' },
];

export const DOCUMENT_TYPE_OPTIONS = DOCUMENT_TYPES;

export const DOCUMENT_TYPE_LABELS = Object.fromEntries(
  DOCUMENT_TYPES.map((item) => [item.id, item.label]),
);

export const DOCUMENT_TYPE_ALIASES = {
  diploma: 'diploma',
  transcript: 'transcript_of_records',
  transcript_of_records: 'transcript_of_records',
  tor: 'transcript_of_records',
  certificate: 'certificate',
  id: 'id_card',
  id_card: 'id_card',
  good_moral: 'good_moral_certificate',
  good_moral_certificate: 'good_moral_certificate',
  certification: 'general_certification',
  general_certification: 'general_certification',
  enrollment: 'enrollment_certificate',
  enrollment_certificate: 'enrollment_certificate',
  honorable_dismissal: 'honorable_dismissal',
  authentication_letter: 'authentication_letter',
  other: 'other',
};

const slugifyDocumentType = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const normalizeDocumentType = (value) => {
  const slug = slugifyDocumentType(value);
  return DOCUMENT_TYPE_ALIASES[slug] || slug;
};

export const getDocumentTypeLabel = (value) => {
  if (!value) return 'Unknown';
  const normalized = normalizeDocumentType(value);
  return (
    DOCUMENT_TYPE_LABELS[normalized] ||
    String(value)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
};

import {
  AcademicCapIcon,
  BriefcaseIcon,
  ClipboardDocumentCheckIcon,
  SparklesIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

// Fixed choices for the alumni profile form (CHED graduate tracer study wording).

export const degreeReasons = [
  "High grades in the course or subject area(s) related to the course",
  "Good grades in high school",
  "Influence of parents and relatives",
  "Peer influence",
  "Inspired by a role model",
  "Strong passion for the profession",
  "Prospect for immediate employment",
  "Status or prestige of the profession",
  "Availability of course offering in chosen institution",
  "Prospect of career advancement",
  "Affordable for the family",
  "Prospect of attractive compensation",
  "Opportunity for employment abroad",
  "No particular choice or no better idea"
];

// Employment Data Options
export const employmentOptions = ["Yes", "No", "Never Employed"];

export const companySectorOptions = [
  "Government Institution",
  "Private Institution"
];

export const businessLineOptions = [
  "Agriculture, Hunting, and Forestry",
  "Fishing",
  "Mining and Quarrying",
  "Manufacturing",
  "Electricity, Gas, and Water Supply",
  "Construction",
  "Wholesale and retail trade, repair of motor vehicles, motorcycles and personal and household goods",
  "Hotels and Restaurants",
  "Transport, Storage, Information and Communication",
  "Financial Intermediation",
  "Real Estate, Renting, and Business Activities",
  "Public Administration and Defense",
  "Education",
  "Health and Social Work",
  "Other community, Social and Personal activities",
  "Private households with employed persons",
  "Extra-territorial Organizations and Bodies"
];

export const workLocationOptions = [
  "Within the country",
  "Abroad"
];

export const stayReasons = [
  "Salaries and benefits",
  "Career Challenge",
  "Related to special skill",
  "Related to course or program of study",
  "Proximity to residence",
  "Peer influence",
  "Family influence"
];

export const firstJobReasons = [
  "Salaries and benefits",
  "Career Challenge",
  "Related to special skills",
  "Proximity to residence",
  "For experience"
];

export const tenureDurations = [
  "Less than a month",
  "1 to 6 months",
  "7-11 months",
  "1 year to less than 2 years",
  "2 years to less than 3 years",
  "3 years to less than 4 years"
];

export const jobAcquisitionMethods = [
  "Response to an advertisement",
  "Recommended by someone",
  "Public employment (thru PESO or related agencies)",
  "As walk-in applicant",
  "Information from friends",
  "Arranged by school's job placement services office (School Job fair, job posting in school bulletin and school page)"
];

export const jobLevelOptions = [
  "Rank and File, Clerical",
  "Professional, Technical or Supervisory",
  "Managerial or Executive",
  "Self-Employed"
];

// List of Philippine regions for dropdown
export const philippineRegions = [
  "National Capital Region (NCR)",
  "Cordillera Administrative Region (CAR)",
  "Region I (Ilocos Region)",
  "Region II (Cagayan Valley)",
  "Region III (Central Luzon)",
  "Region IV-A (CALABARZON)",
  "Region IV-B (MIMAROPA)",
  "Region V (Bicol Region)",
  "Region VI (Western Visayas)",
  "Region VII (Central Visayas)",
  "Region VIII (Eastern Visayas)",
  "Region IX (Zamboanga Peninsula)",
  "Region X (Northern Mindanao)",
  "Region XI (Davao Region)",
  "Region XII (SOCCSKSARGEN)",
  "Region XIII (Caraga)",
  "Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)"
];

// Tab navigation for the profile page.
export const PROFILE_TABS = [
  { id: 'personal', name: 'Personal Information', shortName: 'Personal', icon: UserCircleIcon },
  { id: 'education', name: 'Educational Background', shortName: 'Education', icon: AcademicCapIcon },
  { id: 'eligibility', name: 'Eligibility & Licensure', shortName: 'Licensure', icon: ClipboardDocumentCheckIcon },
  { id: 'employment', name: 'Employment Data', shortName: 'Employment', icon: BriefcaseIcon },
  { id: 'skills', name: 'Skills & Abilities', shortName: 'Skills', icon: SparklesIcon },
];

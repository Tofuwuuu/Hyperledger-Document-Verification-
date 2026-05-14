import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  IdentificationIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { alumniService } from '../../services/api';

const initialForm = {
  id: '',
  user_id: '',
  full_name: '',
  email: '',
  student_id: '',
  phone: '',
  course: '',
  department: '',
  graduation_year: '',
  graduation_month: '',
  batch: '',
  birthday: '',
  sex: '',
  civil_status: '',
  address: '',
  region_of_origin: '',
  bio: '',
  employment_status: '',
  occupation: '',
  company_name: '',
  data_privacy_consent: false,
};

const requiredFields = ['full_name', 'email', 'student_id', 'course', 'graduation_year'];

const fieldGroups = [
  {
    title: 'Identity',
    icon: UserCircleIcon,
    fields: [
      { name: 'full_name', label: 'Full name', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'student_id', label: 'Student ID', required: true },
      { name: 'phone', label: 'Phone' },
    ],
  },
  {
    title: 'Academic Record',
    icon: IdentificationIcon,
    fields: [
      { name: 'course', label: 'Course / Program', required: true },
      { name: 'department', label: 'Department' },
      { name: 'graduation_year', label: 'Graduation year', type: 'number', required: true },
      { name: 'graduation_month', label: 'Graduation month' },
      { name: 'batch', label: 'Batch' },
    ],
  },
  {
    title: 'Personal Details',
    icon: CheckCircleIcon,
    fields: [
      { name: 'birthday', label: 'Birthday', type: 'date' },
      { name: 'sex', label: 'Sex' },
      { name: 'civil_status', label: 'Civil status' },
      { name: 'region_of_origin', label: 'Region of origin' },
      { name: 'address', label: 'Address', wide: true },
      { name: 'bio', label: 'Bio', wide: true, multiline: true },
    ],
  },
  {
    title: 'Career',
    icon: IdentificationIcon,
    fields: [
      { name: 'employment_status', label: 'Employment status' },
      { name: 'occupation', label: 'Occupation' },
      { name: 'company_name', label: 'Company name' },
    ],
  },
];

const normalizeProfile = (profile = {}, currentUser = {}) => ({
  ...initialForm,
  ...profile,
  id: profile._id || profile.id || currentUser._id || currentUser.id || '',
  user_id: profile.user_id || currentUser._id || currentUser.id || '',
  full_name: profile.full_name || currentUser.full_name || '',
  email: profile.email || currentUser.email || '',
  graduation_year: profile.graduation_year || '',
  data_privacy_consent: Boolean(profile.data_privacy_consent),
});

export default function ProfileEditPage() {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState(() => normalizeProfile({}, currentUser));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const completion = useMemo(() => {
    const completed = requiredFields.filter((field) => String(formData[field] || '').trim()).length;
    return Math.round((completed / requiredFields.length) * 100);
  }, [formData]);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      const userId = currentUser?._id || currentUser?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const response = await alumniService.getAlumniByUserId(userId);
        if (!cancelled) {
          setFormData(normalizeProfile(response?.data || {}, currentUser));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load profile details.');
          setFormData(normalizeProfile({}, currentUser));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const handleChange = (event) => {
    const { name, type, checked, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        ...formData,
        user_id: formData.user_id || currentUser?._id || currentUser?.id,
      };
      const hasExistingProfile = Boolean(payload.id);
      const response = hasExistingProfile
        ? await alumniService.updateProfile(payload)
        : await alumniService.createProfile(payload);
      const savedProfile = response?.data || payload;
      setFormData(normalizeProfile(savedProfile, currentUser));
      toast.success('Profile saved successfully');
    } catch (err) {
      const message = err.response?.data?.detail || err.message || 'Failed to save profile.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-cvsu-green" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/alumni/profile" className="inline-flex items-center text-sm font-medium text-cvsu-green hover:text-cvsu-green/80">
            <ArrowLeftIcon className="mr-1 h-4 w-4" />
            Back to profile
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Edit Profile</h1>
          <p className="mt-1 text-sm text-slate-500">Keep your alumni record complete so document requests can move without delays.</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">Profile completion</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 w-36 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-cvsu-green" style={{ width: `${completion}%` }} />
            </div>
            <span className="text-sm font-semibold text-slate-900">{completion}%</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {fieldGroups.map((group) => {
          const Icon = group.icon;
          return (
            <section key={group.title} className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <Icon className="h-5 w-5 text-cvsu-green" />
                <h2 className="text-base font-semibold text-slate-950">{group.title}</h2>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                {group.fields.map((field) => (
                  <label key={field.name} className={field.wide ? 'sm:col-span-2' : ''}>
                    <span className="text-sm font-medium text-slate-700">
                      {field.label}
                      {field.required && <span className="text-red-500"> *</span>}
                    </span>
                    {field.multiline ? (
                      <textarea
                        name={field.name}
                        value={formData[field.name] || ''}
                        onChange={handleChange}
                        rows={4}
                        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-cvsu-green focus:outline-none focus:ring-1 focus:ring-cvsu-green"
                      />
                    ) : (
                      <input
                        name={field.name}
                        type={field.type || 'text'}
                        value={formData[field.name] || ''}
                        onChange={handleChange}
                        required={field.required}
                        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-cvsu-green focus:outline-none focus:ring-1 focus:ring-cvsu-green"
                      />
                    )}
                  </label>
                ))}
              </div>
            </section>
          );
        })}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <label className="flex items-start gap-3">
            <input
              name="data_privacy_consent"
              type="checkbox"
              checked={formData.data_privacy_consent}
              onChange={handleChange}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-cvsu-green focus:ring-cvsu-green"
            />
            <span className="text-sm text-slate-600">
              I confirm that the information provided is accurate and may be used for alumni verification and document request processing.
            </span>
          </label>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            to="/alumni/profile"
            className="inline-flex justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex justify-center rounded-md bg-cvsu-green px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cvsu-green/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}

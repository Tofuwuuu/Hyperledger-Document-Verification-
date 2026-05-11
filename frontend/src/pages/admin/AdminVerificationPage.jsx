import { useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
  EyeIcon,
  FunnelIcon,
  IdentificationIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { adminVerificationService } from '../../services/api';
import { API_ORIGIN } from '../../config';

const API_BASE_URL = API_ORIGIN.replace(/\/$/, '');

const FILTERS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All Requests' }
];

const FALLBACK_PREVIEW =
  'data:image/svg+xml;charset=UTF-8,%3Csvg width="640" height="420" xmlns="http://www.w3.org/2000/svg"%3E%3Crect width="640" height="420" rx="12" fill="%23f1f5f9"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="22" text-anchor="middle" fill="%2364748b"%3EPreview Not Available%3C/text%3E%3C/svg%3E';

function normalizeStatus(status) {
  const value = String(status || 'pending').toLowerCase();
  if (value === 'verified') return 'approved';
  return value;
}

function statusClasses(status) {
  const normalized = normalizeStatus(status);
  if (normalized === 'approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (normalized === 'rejected') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function formatStatus(status) {
  const normalized = normalizeStatus(status);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getFileUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url.replace('/api/v1/uploads/', '/uploads/');
  }
  const cleanPath = url.replace(/^\//, '').replace(/^api\/v1\/uploads\//, 'uploads/');
  return `${API_BASE_URL}/${cleanPath}`;
}

function formatDate(dateString) {
  if (!dateString) return 'Not available';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export default function AdminVerificationPage() {
  const [verificationRequests, setVerificationRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const [previewState, setPreviewState] = useState({ loading: false, available: false, reason: '' });

  useEffect(() => {
    fetchVerificationRequests();
  }, []);

  const fetchVerificationRequests = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await adminVerificationService.getVerificationRequests('all');
      const data = Array.isArray(response.data) ? response.data : [];
      setVerificationRequests(data);

      setSelectedRequest((current) => {
        if (!data.length) return null;
        if (!current) return data[0];
        return data.find((request) => request.id === current.id) || data[0];
      });
    } catch (err) {
      console.error('Error fetching verification requests:', err);
      setError(err.message || 'Failed to fetch verification requests');
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    return verificationRequests.reduce(
      (summary, request) => {
        const status = normalizeStatus(request.status);
        summary.all += 1;
        summary[status] = (summary[status] || 0) + 1;
        return summary;
      },
      { all: 0, pending: 0, approved: 0, rejected: 0 }
    );
  }, [verificationRequests]);

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return verificationRequests.filter((request) => {
      const statusMatch = statusFilter === 'all' || normalizeStatus(request.status) === statusFilter;
      if (!statusMatch) return false;
      if (!query) return true;

      return [
        request.documentType,
        request.studentName,
        request.studentId,
        request.program,
        request.status
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [searchQuery, statusFilter, verificationRequests]);

  useEffect(() => {
    if (!filteredRequests.length) {
      setSelectedRequest(null);
      return;
    }

    if (!selectedRequest || !filteredRequests.some((request) => request.id === selectedRequest.id)) {
      setSelectedRequest(filteredRequests[0]);
    }
  }, [filteredRequests, selectedRequest]);

  const handleApproveRequest = async (id) => {
    setProcessingAction(true);
    setCurrentRequestId(id);

    try {
      await adminVerificationService.approveVerification(id);
      await fetchVerificationRequests();
    } catch (err) {
      console.error('Error approving request:', err);
      setError(`Failed to approve document: ${err.message}`);
    } finally {
      setProcessingAction(false);
      setCurrentRequestId(null);
    }
  };

  const openRejectionModal = (id) => {
    setCurrentRequestId(id);
    setRejectionReason('');
    setShowRejectionModal(true);
  };

  const handleRejectRequest = async () => {
    if (!currentRequestId) return;
    setProcessingAction(true);

    try {
      await adminVerificationService.rejectVerification(currentRequestId, rejectionReason);
      setShowRejectionModal(false);
      await fetchVerificationRequests();
    } catch (err) {
      console.error('Error rejecting request:', err);
      setError(`Failed to reject document: ${err.message}`);
    } finally {
      setProcessingAction(false);
      setCurrentRequestId(null);
    }
  };

  const selectedFileUrl = getFileUrl(selectedRequest?.fileUrl);
  const selectedPreviewUrl = getFileUrl(selectedRequest?.documentPreviewUrl || selectedRequest?.fileUrl);
  const selectedStatus = normalizeStatus(selectedRequest?.status);
  const selectedMimeType = String(selectedRequest?.mimeType || '').toLowerCase();
  const isSelectedPdf = selectedMimeType.includes('pdf') || selectedFileUrl.toLowerCase().includes('.pdf');

  useEffect(() => {
    if (!selectedRequest || !selectedPreviewUrl || selectedRequest.fileExists === false) {
      setPreviewState({
        loading: false,
        available: false,
        reason: selectedRequest?.fileExists === false
          ? 'The file record exists, but the uploaded file was not found on the server.'
          : 'No preview file is attached to this request.'
      });
      return;
    }

    let cancelled = false;
    setPreviewState({ loading: true, available: false, reason: '' });

    fetch(selectedPreviewUrl, { method: 'HEAD' })
      .then((response) => {
        if (cancelled) return;
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || contentType.includes('application/json')) {
          setPreviewState({
            loading: false,
            available: false,
            reason: response.status === 404
              ? 'The preview URL returned 404 Not Found.'
              : 'The server did not return a previewable file.'
          });
          return;
        }
        setPreviewState({ loading: false, available: true, reason: '' });
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewState({
            loading: false,
            available: false,
            reason: 'The preview file could not be reached.'
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPreviewUrl, selectedRequest]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-cvsu-green/10 text-cvsu-green">
                  <DocumentCheckIcon className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-slate-950">Document Verifications</h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Review student documents, inspect details, and record decisions.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchVerificationRequests}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowPathIcon className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              className={`rounded-lg border px-4 py-3 text-left transition ${
                statusFilter === filter.id
                  ? 'border-cvsu-green bg-cvsu-green text-white shadow-sm'
                  : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-cvsu-green/50 hover:bg-white'
              }`}
            >
              <span className="block text-xs font-semibold uppercase tracking-wide opacity-80">{filter.label}</span>
              <span className="mt-1 block text-2xl font-semibold">{counts[filter.id] || 0}</span>
            </button>
          ))}
        </div>

        <div className="border-t border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-xl flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by student, ID, program, or document type"
                className="block w-full rounded-lg border-slate-300 pl-10 text-sm shadow-sm focus:border-cvsu-green focus:ring-cvsu-green"
              />
            </div>
            <div className="inline-flex items-center gap-2 text-sm text-slate-500">
              <FunnelIcon className="h-4 w-4" />
              Showing {filteredRequests.length} of {verificationRequests.length} requests
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-200 border-b-cvsu-green" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <XCircleIcon className="mt-0.5 h-5 w-5 text-red-500" />
            <div>
              <h3 className="text-sm font-semibold text-red-800">Error loading verification requests</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={fetchVerificationRequests}
                className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">No verification requests found</h3>
          <p className="mt-1 text-sm text-slate-500">Try changing the status filter or search term.</p>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_480px]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">Requests</h2>
              <p className="mt-1 text-sm text-slate-500">Select a document to inspect its preview and decision history.</p>
            </div>
            <ul className="divide-y divide-slate-100">
              {filteredRequests.map((request) => {
                const active = selectedRequest?.id === request.id;
                const requestStatus = normalizeStatus(request.status);

                return (
                  <li key={request.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(request)}
                      className={`block w-full px-5 py-4 text-left transition ${
                        active ? 'bg-emerald-50/70 ring-1 ring-inset ring-cvsu-green/40' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {request.documentType || 'Document'}
                            </p>
                            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClasses(requestStatus)}`}>
                              {formatStatus(requestStatus)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                            <span className="inline-flex items-center gap-1.5">
                              <UserCircleIcon className="h-4 w-4 text-slate-400" />
                              {request.studentName || 'Unknown Student'}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <IdentificationIcon className="h-4 w-4 text-slate-400" />
                              {request.studentId || 'N/A'}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-500">{request.program || 'Program not specified'}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-sm text-slate-500">
                          <CalendarDaysIcon className="h-4 w-4 text-slate-400" />
                          {formatDate(request.submissionDate)}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {selectedRequest && (
            <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6 xl:self-start">
              <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">Document Details</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedRequest.documentType || 'Document'} submitted by {selectedRequest.studentName || 'Unknown Student'}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(selectedStatus)}`}>
                    {formatStatus(selectedStatus)}
                  </span>
                </div>
              </div>

              <div className="space-y-6 p-5">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">Document Preview</h3>
                    {selectedFileUrl && (
                      <a
                        href={selectedFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-cvsu-green hover:text-cvsu-green/80"
                      >
                        <EyeIcon className="h-4 w-4" />
                        Open file
                      </a>
                    )}
                  </div>
                  <div className="h-72 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {previewState.loading ? (
                      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-slate-500">
                        <ArrowPathIcon className="h-8 w-8 animate-spin text-cvsu-green" />
                        <p className="mt-3 text-sm font-semibold text-slate-700">Checking preview file</p>
                      </div>
                    ) : !previewState.available ? (
                      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                        <DocumentTextIcon className="h-12 w-12 text-slate-400" />
                        <p className="mt-3 text-sm font-semibold text-slate-800">Preview not available</p>
                        <p className="mt-1 max-w-sm text-sm text-slate-500">
                          {previewState.reason || 'The uploaded file could not be previewed.'}
                        </p>
                        {selectedFileUrl && (
                          <a
                            href={selectedFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                          >
                            <EyeIcon className="mr-2 h-4 w-4" />
                            Try opening file
                          </a>
                        )}
                      </div>
                    ) : isSelectedPdf && selectedFileUrl ? (
                      <iframe title="Document preview" src={selectedFileUrl} className="h-full w-full bg-white" />
                    ) : (
                      <img
                        src={selectedPreviewUrl || FALLBACK_PREVIEW}
                        alt="Document preview"
                        className="h-full w-full object-contain"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = FALLBACK_PREVIEW;
                        }}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Student Information</h3>
                  <dl className="overflow-hidden rounded-lg border border-slate-200">
                    {[
                      ['Student ID', selectedRequest.studentId || 'N/A'],
                      ['Program', selectedRequest.program || 'N/A'],
                      ['Submitted', formatDate(selectedRequest.submissionDate)]
                    ].map(([label, value], index) => (
                      <div key={label} className={`grid grid-cols-[140px_minmax(0,1fr)] gap-3 px-4 py-3 ${index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                        <dt className="text-sm font-medium text-slate-500">{label}</dt>
                        <dd className="break-words text-sm font-semibold text-slate-950">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Verification Actions</h3>
                  {selectedStatus === 'pending' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleApproveRequest(selectedRequest.id)}
                        disabled={processingAction}
                        className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {processingAction && currentRequestId === selectedRequest.id ? (
                          <>
                            <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />
                            Processing
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="mr-2 h-4 w-4" />
                            Approve
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openRejectionModal(selectedRequest.id)}
                        disabled={processingAction}
                        className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <XCircleIcon className="mr-2 h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div className={`rounded-lg border p-4 ${statusClasses(selectedStatus)}`}>
                      <div className="flex items-start gap-3">
                        {selectedStatus === 'approved' ? (
                          <CheckCircleIcon className="mt-0.5 h-5 w-5" />
                        ) : (
                          <XCircleIcon className="mt-0.5 h-5 w-5" />
                        )}
                        <div>
                          <p className="text-sm font-semibold">Document {selectedStatus}</p>
                          <p className="mt-1 text-sm opacity-90">{selectedRequest.notes || 'No notes provided.'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      )}

      {showRejectionModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 py-6">
            <div className="fixed inset-0 bg-slate-900/50" aria-hidden="true" onClick={() => !processingAction && setShowRejectionModal(false)} />
            <div className="relative w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-50 text-red-600">
                    <XCircleIcon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">Reject Document</h3>
                    <p className="mt-1 text-sm text-slate-500">The reason will be visible to the student.</p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-5">
                <label htmlFor="rejectionReason" className="block text-sm font-semibold text-slate-700">
                  Rejection reason
                </label>
                <textarea
                  id="rejectionReason"
                  rows={5}
                  className="mt-2 block w-full rounded-lg border-slate-300 text-sm shadow-sm focus:border-cvsu-green focus:ring-cvsu-green"
                  placeholder="Explain what needs to be corrected or resubmitted"
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                />
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => setShowRejectionModal(false)}
                  disabled={processingAction}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleRejectRequest}
                  disabled={processingAction}
                >
                  {processingAction ? 'Processing...' : 'Reject Document'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

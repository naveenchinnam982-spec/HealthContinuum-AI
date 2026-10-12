import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowRight, CalendarClock, CheckCircle2, FileSearch, FileText,
  FlaskConical, RefreshCw, ShieldCheck, Stethoscope, Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { overviewService, reviewService } from '@/services/api';
import { Card, CardHeader, EmptyState, LoadingState, PageHeader, StatusBadge } from '@/components/ui';
import type { ReviewComparisonItem, PrescriptionDiffItem } from '@/types';

type DashboardStats = {
  authorizedPatients: number;
  recordsAwaitingReview: number;
  followUpsDue: number;
  reviewsCompleted: number;
};

export function DoctorDashboardV2() {
  const { doctor } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [labReviews, setLabReviews] = useState<ReviewComparisonItem[]>([]);
  const [prescriptionReviews, setPrescriptionReviews] = useState<PrescriptionDiffItem[]>([]);

  const loadDashboard = async () => {
    if (!doctor) return;
    setLoading(true);
    setError(null);
    try {
      const [summary, labs, prescriptions] = await Promise.all([
        overviewService.getOverviewStats(doctor),
        reviewService.getReviewItems(),
        reviewService.getPrescriptionDiffs(),
      ]);
      setStats(summary);
      setLabReviews(labs);
      setPrescriptionReviews(prescriptions);
    } catch {
      setError('We could not load the doctor workspace. Check the API connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [doctor?.id]);

  if (loading) return <LoadingState message="Preparing your clinical workspace..." />;

  const pendingLabs = labReviews.filter((item) => item.reviewAction === null);
  const pendingPrescriptions = prescriptionReviews.filter((item) => item.reviewAction === null);
  const totalPending = pendingLabs.length + pendingPrescriptions.length;

  const metrics = [
    { label: 'Patients with access', value: stats?.authorizedPatients ?? '—', icon: Users, tone: 'bg-sky-50 text-sky-700' },
    { label: 'Documents to verify', value: totalPending, icon: FileSearch, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Follow-ups due', value: stats?.followUpsDue ?? '—', icon: CalendarClock, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Reviews completed', value: stats?.reviewsCompleted ?? '—', icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`Good day, ${doctor?.fullName || 'Doctor'}`}
        subtitle="Your clinical workspace for reviewing extracted medical information and maintaining care continuity."
        action={<button type="button" onClick={() => void loadDashboard()} className="btn-secondary"><RefreshCw className="h-4 w-4" /> Refresh</button>}
      />

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-800">
          <Activity className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-semibold">Workspace connection issue</p><p className="mt-1">{error}</p></div>
        </div>
      )}

      <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-teal-50 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm"><ShieldCheck className="h-6 w-6" /></div>
            <div>
              <p className="text-sm font-semibold text-navy-900">Doctor-verified records, not blind AI approvals</p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-navy-600">OCR suggestions are review candidates. Compare extracted values with the original document, correct errors, and explicitly confirm before information is treated as verified.</p>
            </div>
          </div>
          <Link to="/doctor/continuity-review" className="btn-primary shrink-0"><FileSearch className="h-4 w-4" /> Open review queue <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm text-navy-500">{metric.label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-navy-900">{metric.value}</p></div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${metric.tone}`}><metric.icon className="h-5 w-5" /></div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Priority verification queue" subtitle="Extracted lab values and prescription changes that need a clinician's decision" action={<Link to="/doctor/continuity-review" className="btn-ghost text-xs">Review all <ArrowRight className="h-4 w-4" /></Link>} />
          {totalPending === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title="No pending verification items" message="When documents or record comparisons need review, they will appear here." />
          ) : (
            <div className="divide-y divide-navy-100">
              {pendingLabs.slice(0, 4).map((item) => (
                <Link key={`lab-${item.id}`} to="/doctor/continuity-review" className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-sky-50/60">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-lg bg-sky-50 p-2 text-sky-700"><FlaskConical className="h-4 w-4" /></div>
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-navy-900">{item.testName}</p><p className="mt-1 text-xs text-navy-500">Extracted value: {item.currentValue} {item.currentUnit} · {item.currentDate}</p><p className="mt-1 text-xs text-navy-400">Compare with prior result and source record</p></div>
                  </div>
                  <StatusBadge variant="warning">Needs review</StatusBadge>
                </Link>
              ))}
              {pendingPrescriptions.slice(0, Math.max(0, 4 - pendingLabs.length)).map((item) => (
                <Link key={`rx-${item.id}`} to="/doctor/continuity-review" className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-sky-50/60">
                  <div className="flex min-w-0 items-start gap-3"><div className="rounded-lg bg-violet-50 p-2 text-violet-700"><FileText className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-navy-900">{item.medicationName}</p><p className="mt-1 text-xs text-navy-500">Prescription change · {item.currentDate}</p><p className="mt-1 text-xs text-navy-400">Confirm dose, route and frequency against the source</p></div></div>
                  <StatusBadge variant="warning">Needs review</StatusBadge>
                </Link>
              ))}
            </div>
          )}
          <div className="border-t border-navy-100 bg-navy-50/60 px-5 py-3 text-xs leading-5 text-navy-500">AI/OCR output is assistive only. A clinician must verify each item against the source document; uncertain text should remain unconfirmed.</div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Clinical shortcuts" subtitle="Go directly to a key workflow" />
            <div className="space-y-2 p-4">
              <Link to="/doctor/continuity-review" className="flex items-center gap-3 rounded-xl border border-navy-100 p-3 transition hover:border-sky-200 hover:bg-sky-50/50"><div className="rounded-lg bg-sky-50 p-2 text-sky-700"><FileSearch className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-navy-900">OCR & verification</p><p className="mt-0.5 text-xs text-navy-500">Review lab and prescription changes</p></div><ArrowRight className="h-4 w-4 text-navy-400" /></Link>
              <Link to="/doctor/shared-records" className="flex items-center gap-3 rounded-xl border border-navy-100 p-3 transition hover:border-sky-200 hover:bg-sky-50/50"><div className="rounded-lg bg-teal-50 p-2 text-teal-700"><ShieldCheck className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-navy-900">Authorized records</p><p className="mt-0.5 text-xs text-navy-500">Use the patient-shared access PIN</p></div><ArrowRight className="h-4 w-4 text-navy-400" /></Link>
              <Link to="/doctor/patients" className="flex items-center gap-3 rounded-xl border border-navy-100 p-3 transition hover:border-sky-200 hover:bg-sky-50/50"><div className="rounded-lg bg-violet-50 p-2 text-violet-700"><Users className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-navy-900">Patient directory</p><p className="mt-0.5 text-xs text-navy-500">Find a patient and their care history</p></div><ArrowRight className="h-4 w-4 text-navy-400" /></Link>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3"><div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Stethoscope className="h-5 w-5" /></div><div><h2 className="text-sm font-semibold text-navy-900">Clinical safety reminder</h2><p className="mt-1 text-sm leading-6 text-navy-600">Verify patient identity and consent before opening records. Never rely on OCR confidence alone for a diagnosis, medicine, or dosage decision.</p></div></div>
          </Card>
        </div>
      </div>
    </div>
  );
}

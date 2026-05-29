'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Users, Bug, Shield, AlertTriangle, Eye,
  CheckCircle, XCircle, Ban, FileWarning, Activity,
} from 'lucide-react';
import { GlassCard, Button, Badge, Avatar, Skeleton, Input, Textarea } from '@/components/ui';
import { formatNumber, formatDate } from '@/lib/utils';

export default function AdminDashboard() {
  const [view, setView] = useState<'overview' | 'reports' | 'flagged' | 'users'>('overview');
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [flagged, setFlagged] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [view]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?view=${view}`);
      const data = await res.json();
      if (!data.success) return;

      if (view === 'overview') setStats(data.data);
      if (view === 'reports') setReports(data.data);
      if (view === 'flagged') setFlagged(data.data);
    } catch (err) {
      console.error('Admin load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function adminAction(action: string, payload: Record<string, unknown>) {
    await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    loadData();
  }

  const navItems = [
    { value: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { value: 'reports' as const, label: 'Reports', icon: AlertTriangle },
    { value: 'flagged' as const, label: 'Flagged', icon: FileWarning },
    { value: 'users' as const, label: 'Users', icon: Users },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-red-400" />
        <h1 className="text-2xl font-display font-bold text-white">Admin Panel</h1>
      </div>

      {/* Nav */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {navItems.map((item) => (
          <button
            key={item.value}
            onClick={() => setView(item.value)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              view === item.value
                ? 'bg-red-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {view === 'overview' && (
        loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : stats && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400' },
              { label: 'Total Species', value: stats.totalSpecies, icon: Bug, color: 'text-green-400' },
              { label: 'Submissions', value: stats.totalSubmissions, icon: Activity, color: 'text-purple-400' },
              { label: 'Today', value: stats.todaySubmissions, icon: Activity, color: 'text-amber-400' },
              { label: 'Pending Reports', value: stats.pendingReports, icon: AlertTriangle, color: 'text-red-400' },
              { label: 'Banned Users', value: stats.bannedUsers, icon: Ban, color: 'text-gray-400' },
            ].map((stat) => (
              <GlassCard key={stat.label} className="p-4">
                <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
                <p className="text-2xl font-bold text-white">{formatNumber(stat.value)}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </GlassCard>
            ))}
          </div>
        )
      )}

      {/* Reports */}
      {view === 'reports' && (
        loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report: any) => (
              <GlassCard key={report.id} className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="warning">{report.reason}</Badge>
                      <span className="text-xs text-gray-500">
                        {formatDate(report.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mb-1">
                      Reported by <strong>{report.reporter?.username}</strong>
                      {report.reportedUser && (
                        <> against <strong>{report.reportedUser.username}</strong></>
                      )}
                    </p>
                    {report.description && (
                      <p className="text-xs text-gray-500 mb-2">{report.description}</p>
                    )}
                    {report.submission && (
                      <div className="mb-2">
                        <img
                          src={report.submission.imageUrl}
                          alt="Reported"
                          className="w-32 h-32 object-cover rounded-lg border border-white/10"
                        />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => adminAction('resolve_report', {
                          reportId: report.id,
                          resolution: 'RESOLVED',
                          note: 'Verified and resolved',
                        })}
                      >
                        <CheckCircle className="h-3 w-3" />
                        Resolve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => adminAction('resolve_report', {
                          reportId: report.id,
                          resolution: 'DISMISSED',
                          note: 'False report',
                        })}
                      >
                        <XCircle className="h-3 w-3" />
                        Dismiss
                      </Button>
                      {report.reportedUserId && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => adminAction('ban_user', {
                            userId: report.reportedUserId,
                            reason: `Banned due to report: ${report.reason}`,
                          })}
                        >
                          <Ban className="h-3 w-3" />
                          Ban User
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
            {reports.length === 0 && (
              <GlassCard className="p-8 text-center">
                <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No pending reports</p>
              </GlassCard>
            )}
          </div>
        )
      )}

      {/* Flagged Submissions */}
      {view === 'flagged' && (
        loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {flagged.map((sub: any) => (
              <GlassCard key={sub.id} className="p-4">
                <div className="flex gap-3">
                  <img
                    src={sub.imageUrl}
                    alt="Flagged"
                    className="w-20 h-20 object-cover rounded-lg border border-white/10"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="danger">{sub.status}</Badge>
                      <span className="text-xs text-gray-500">
                        Score: {(sub.fraudScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-sm text-white mb-1">
                      {sub.species?.commonName ?? sub.aiSpeciesGuess ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500">
                      by {sub.user?.username} (trust: {(sub.user?.trustScore * 100).toFixed(0)}%)
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => adminAction('review_submission', {
                          submissionId: sub.id,
                          verdict: 'ACCEPTED',
                        })}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => adminAction('review_submission', {
                          submissionId: sub.id,
                          verdict: 'REJECTED',
                        })}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
            {flagged.length === 0 && (
              <GlassCard className="p-8 text-center">
                <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No flagged submissions</p>
              </GlassCard>
            )}
          </div>
        )
      )}
    </div>
  );
}

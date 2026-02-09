import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

export function PackageSkeletonLoader() {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-3 md:p-4 lg:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 bg-slate-200 rounded-lg animate-pulse flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-32 animate-pulse" />
              <div className="h-3 bg-slate-200 rounded w-24 animate-pulse" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-6 bg-slate-200 rounded px-2 w-20 animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ConsolidationSkeletonLoader() {
  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <div className="p-3 md:p-4 lg:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 bg-slate-200 rounded-lg animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-40 animate-pulse" />
              <div className="h-3 bg-slate-200 rounded w-32 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2 justify-between md:justify-end">
            <div className="h-6 bg-slate-200 rounded w-24 animate-pulse" />
            <div className="h-6 bg-slate-200 rounded w-16 animate-pulse" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function StatsGridSkeletonLoader() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="border-0 shadow-md">
          <CardContent className="p-2 md:p-3 lg:p-5">
            <div className="space-y-2">
              <div className="h-3 bg-slate-200 rounded w-16 animate-pulse" />
              <div className="h-6 bg-slate-200 rounded w-12 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ListSkeletonLoader({ count = 5 }) {
  return (
    <div className="space-y-3 md:space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <PackageSkeletonLoader key={i} />
      ))}
    </div>
  );
}

export function HeaderSkeletonLoader() {
  return (
    <div className="bg-gradient-to-r from-slate-200 to-slate-300 rounded-lg md:rounded-2xl p-4 md:p-6 lg:p-8 animate-pulse">
      <div className="space-y-4">
        <div className="h-8 bg-slate-300 rounded w-48 animate-pulse" />
        <div className="h-4 bg-slate-300 rounded w-64 animate-pulse" />
      </div>
    </div>
  );
}

export function TableSkeletonLoader({ rows = 5, cols = 4 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-3">
          {Array.from({ length: cols }).map((_, col) => (
            <div
              key={col}
              className="h-8 bg-slate-200 rounded animate-pulse flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
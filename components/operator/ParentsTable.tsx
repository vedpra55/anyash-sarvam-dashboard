"use client";

import React from "react";
import { Phone, ArrowRight, Eye, AlertCircle, ShieldAlert } from "lucide-react";
import { ParentProfile } from "@/lib/types";

interface ParentsTableProps {
  parents: ParentProfile[];
  onSelectParent: (parent: ParentProfile) => void;
  onCallParent: (parent: ParentProfile) => void;
  onReviewParent?: (parent: ParentProfile) => void;
}

export function ParentsTable({
  parents,
  onSelectParent,
  onCallParent,
  onReviewParent,
}: ParentsTableProps) {
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "Active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Active
          </span>
        );
      case "Pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700">
            {status || "Active"}
          </span>
        );
    }
  };

  const getRiskBadge = (risk?: string) => {
    if (!risk || risk === "None" || risk === "—") {
      return (
        <span className="text-[12px] text-[#86868B] font-normal">
          {risk || "None"}
        </span>
      );
    }

    const isUrgent = risk.toLowerCase().includes("urgent") || risk.toLowerCase().includes("chest");
    const isMedium = risk.toLowerCase().includes("knee") || risk.toLowerCase().includes("dizziness");

    if (isUrgent) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
          <ShieldAlert className="w-3 h-3" />
          {risk}
        </span>
      );
    }

    if (isMedium) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
          <AlertCircle className="w-3 h-3" />
          {risk}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700">
        {risk}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
      {/* Table Header Controls */}
      <div className="px-5 py-4 border-b border-[#F0F0F2] flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1D1D1F]">
            Parents
          </h2>
          <p className="text-[12px] text-[#6E6E73] mt-0.5">
            Registered parents under Anyash autonomous daily check-in care
          </p>
        </div>
        <span className="text-xs text-[#86868B] font-medium">
          {parents.length} enrolled
        </span>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#FBFBFC] text-[#6E6E73] text-[11px] font-semibold uppercase tracking-wider">
              <th className="py-3 px-5">Parent</th>
              <th className="py-3 px-4 text-right">Age</th>
              <th className="py-3 px-4">Language</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Last Call</th>
              <th className="py-3 px-4">Next Call</th>
              <th className="py-3 px-4">Risk / Follow-up</th>
              <th className="py-3 px-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F2]">
            {parents.map((parent) => {
              const hasRisk = parent.riskFollowUp && parent.riskFollowUp !== "None" && parent.riskFollowUp !== "—";

              return (
                <tr
                  key={parent.id}
                  onClick={() => onSelectParent(parent)}
                  className="hover:bg-[#F9F9FB] transition-colors cursor-pointer group"
                >
                  {/* Parent Name & Relation */}
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#EFF0F2] text-[#1D1D1F] border border-[#E5E7EB] flex items-center justify-center font-medium text-xs">
                        {parent.parentName.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <div className="font-semibold text-[#1D1D1F] group-hover:text-[#0071E3] transition-colors flex items-center gap-1.5">
                          {parent.parentName}
                        </div>
                        <div className="text-[11px] text-[#86868B]">
                          {parent.familyRelation || (parent.childName ? `Family: ${parent.childName}` : parent.parentPhone)}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Age */}
                  <td className="py-3.5 px-4 text-right font-medium text-[#424245]">
                    {parent.age || 58}
                  </td>

                  {/* Language */}
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F5F5F7] text-[#424245] border border-[#E5E7EB]">
                      {parent.preferredLanguage}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    {getStatusBadge(parent.status)}
                  </td>

                  {/* Last Call */}
                  <td className="py-3.5 px-4 text-[#424245] font-medium">
                    {parent.lastCallText || parent.lastCallDate || "—"}
                  </td>

                  {/* Next Call */}
                  <td className="py-3.5 px-4 text-[#6E6E73]">
                    {parent.nextCallText || "Tomorrow"}
                  </td>

                  {/* Risk / Follow-up */}
                  <td className="py-3.5 px-4">
                    {getRiskBadge(parent.riskFollowUp)}
                  </td>

                  {/* Action Button */}
                  <td className="py-3.5 px-5 text-right">
                    <div
                      className="flex items-center justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* If parent has risk or is flagged, offer Review, otherwise primary Call button */}
                      {hasRisk && onReviewParent ? (
                        <>
                          <button
                            onClick={() => onReviewParent(parent)}
                            className="px-3 py-1.5 bg-[#F5F5F7] hover:bg-[#EBECEF] text-[#1D1D1F] border border-[#E5E7EB] rounded-lg text-xs font-medium transition-all"
                          >
                            Review
                          </button>
                          <button
                            onClick={() => onCallParent(parent)}
                            className="px-3 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0066CC] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Call</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => onCallParent(parent)}
                          className="px-3.5 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0066CC] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
                        >
                          <Phone className="w-3 h-3" />
                          <span>Call</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";
// app/groups/page.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import Icon from "@/components/Icon";
import { Avatar, AvatarStack } from "@/components/Avatar";
import CreateGroupModal from "@/components/modals/CreateGroupModal";
import EditGroupModal from "@/components/modals/EditGroupModal";
import ManageGroupMembersModal from "@/components/modals/ManageGroupMembersModal";
import { categoryById, personById } from "@/lib/data";
import { fmt } from "@/lib/format";
import { groupsApi } from "@/lib/api/groups";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth/AuthContext";
import { SkeletonGroupCard, SkeletonStatCard } from "@/components/Skeleton";
import StatCard from "@/components/ui/StatCard";
import Pagination from "@/components/ui/Pagination";
import type { Group, GroupType } from "@/lib/types";

type ViewMode = "grid" | "list";
type SortMode = "recent" | "name" | "total" | "balance";
type TypeFilter = "all" | GroupType;

const typeLabels: Record<TypeFilter, string> = {
  all: "All Types",
  trip: "Trip",
  home: "Home",
  social: "Social",
  work: "Work",
};

const groupVisuals: Record<GroupType, { image: string; label: string }> = {
  trip: {
    label: "Travel",
    image:
      "linear-gradient(135deg,rgba(91,78,240,.18),rgba(245,158,11,.18)),url('https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=900&q=80')",
  },
  home: {
    label: "Home",
    image:
      "linear-gradient(135deg,rgba(16,185,129,.18),rgba(20,184,166,.18)),url('https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=900&q=80')",
  },
  social: {
    label: "Social",
    image:
      "linear-gradient(135deg,rgba(249,115,22,.20),rgba(236,72,153,.18)),url('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80')",
  },
  work: {
    label: "Work",
    image:
      "linear-gradient(135deg,rgba(14,165,233,.20),rgba(91,78,240,.18)),url('https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80')",
  },
};

const isBackendGroup = (group: Group) => Number.isFinite(Number(group.id));

function balanceMeta(balance: number, currency?: string) {
  if (balance > 0) return { className: "owed", label: "You are owed", value: fmt(balance, currency) };
  if (balance < 0) return { className: "you-owe", label: "You owe", value: fmt(Math.abs(balance), currency) };
  return { className: "settled", label: "Settled", value: "" };
}

function settlementPct(group: Group) {
  const settled = Math.max(0, group.total - Math.abs(group.balance));
  return group.total ? Math.round((settled / group.total) * 100) : 100;
}

export default function GroupsPage() {
  const { groups, createGroup, expenses, refetchSplitting, showToast, loading } = useApp();
  const { user } = useAuth();
  const router = useRouter();
  const userCurrency = user?.preferred_currency || "MAD";
  const myId = user?.id;

  const [selectedId, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<SortMode>("recent");
  // P1.4 — balance quick-filter driven by summary bar clicks
  const [balanceFilter, setBalanceFilter] = useState<"all" | "owe" | "owed">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [cardMenuFor, setCardMenuFor] = useState<string | null>(null);
  const [previewMenuOpen, setPreviewMenuOpen] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [booting, setBooting] = useState(true);
  const [page, setPage] = useState(1);
  const cardMenuRef    = useRef<HTMLDivElement | null>(null);
  const previewMenuRef = useRef<HTMLDivElement | null>(null);
  const pageSize = view === "grid" ? 6 : 7;

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 450);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedId && groups.length > 0) setSelected(groups[0].id);
  }, [groups, selectedId]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!cardMenuRef.current?.contains(event.target as Node)) setCardMenuFor(null);
      if (!previewMenuRef.current?.contains(event.target as Node)) setPreviewMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((group) => typeFilter === "all" || group.type === typeFilter)
      // P1.4 — balance quick-filter from summary bar
      .filter((group) => {
        if (balanceFilter === "owe") return group.balance < 0;
        if (balanceFilter === "owed") return group.balance > 0;
        return true;
      })
      .filter((group) => {
        if (!q) return true;
        const memberMatch = group.memberIds.some((id) => {
          const person = personById(id);
          return `${person.name} ${person.email || ""}`.toLowerCase().includes(q);
        });
        return group.name.toLowerCase().includes(q) || memberMatch;
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "total") return b.total - a.total;
        if (sort === "balance") return Math.abs(b.balance) - Math.abs(a.balance);
        // P1.5 — "recent" now sorts by group.id descending (higher id = created later)
        // group.updated is a formatted string ("Jun 1, 2026") not sortable as-is;
        // group.id is a reliable proxy for creation order until backend exposes updated_at
        if (sort === "recent") return Number(b.id) - Number(a.id);
        return 0;
      });
  }, [groups, query, sort, typeFilter, balanceFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, sort, typeFilter, view, balanceFilter]);

  const selected = groups.find((group) => group.id === selectedId) || filtered[0] || groups[0];
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedGroups = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedExpenses = (
    selected ? expenses.filter((expense) => expense.groupId === selected.id) : []
  ).slice(0, 4);

  const groupStats = useMemo(() => {
    const active = groups.length;
    const owed = groups.filter((group) => group.balance > 0).reduce((sum, group) => sum + group.balance, 0);
    const owe = Math.abs(groups.filter((group) => group.balance < 0).reduce((sum, group) => sum + group.balance, 0));
    const total = groups.reduce((sum, group) => sum + group.total, 0);
    return { active, owed, owe, total };
  }, [groups]);

  const ensureSelected = (group: Group) => {
    setSelected(group.id);
    setCardMenuFor(null);
    setPreviewMenuOpen(false);
  };

  const openPreview = (group: Group) => {
    ensureSelected(group);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches) {
      setMobilePreviewOpen(true);
    }
  };

  const closeMobilePreview = () => {
    setMobilePreviewOpen(false);
    setPreviewMenuOpen(false);
  };

  const editGroup = (group: Group) => {
    ensureSelected(group);
    if (!isBackendGroup(group)) {
      showToast("Demo group editing needs a live backend group");
      return;
    }
    setEditingGroup(group);
  };

  const deleteGroup = async (group: Group) => {
    ensureSelected(group);
    if (!isBackendGroup(group)) {
      showToast("Demo group deletion needs a live backend group");
      return;
    }
    // P0.3 — Swal replaces window.confirm (matches pattern in groups/[id]/page.tsx)
    const result = await Swal.fire({
      title: `Delete "${group.name}"?`,
      text: `This will permanently remove all ${expenses.filter((e) => e.groupId === group.id).length} expenses and ${group.memberIds.length} members. This cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete group",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    try {
      await groupsApi.remove(Number(group.id));
      showToast("Group deleted");
      setSelected(null);
      await refetchSplitting();
    } catch {
      showToast("Could not delete group");
    }
  };

  const leaveGroup = async (group: Group) => {
    ensureSelected(group);
    if (!isBackendGroup(group)) {
      showToast("Demo group leave needs a live backend group");
      return;
    }
    // P0.3 — Swal replaces window.confirm
    const result = await Swal.fire({
      title: `Leave "${group.name}"?`,
      text: "You will lose access to this group's expenses and balances.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#5b4ef0",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, leave group",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    try {
      await groupsApi.leave(Number(group.id));
      showToast("You left the group");
      setSelected(null);
      await refetchSplitting();
    } catch {
      showToast("Could not leave group");
    }
  };

  const openMembers = (group: Group) => {
    ensureSelected(group);
    setMobilePreviewOpen(false);
    setShowMembers(true);
  };

  const menuButtons = (group: Group) => (
    <>
      <button onClick={() => editGroup(group)}><Icon name="edit" size={14} /> Edit group</button>
      <button onClick={() => openMembers(group)}><Icon name="groups" size={14} /> Manage members</button>
      <button onClick={() => leaveGroup(group)}><Icon name="settle" size={14} /> Leave group</button>
      <button className="danger" onClick={() => deleteGroup(group)}><Icon name="trash" size={14} /> Delete group</button>
    </>
  );

  const renderCardMenu = (group: Group) => {
    if (cardMenuFor !== group.id) return null;
    return <div className="group-menu" ref={cardMenuRef}>{menuButtons(group)}</div>;
  };

  const renderPreviewMenu = (group: Group) => {
    if (!previewMenuOpen) return null;
    return <div className="group-menu" ref={previewMenuRef}>{menuButtons(group)}</div>;
  };

  const renderGroupPreview = (group: Group, mode: "desktop" | "mobile") => {
    const previewExpenses = expenses.filter((expense) => expense.groupId === group.id).slice(0, 4);
    const titleId = mode === "mobile" ? "group-mobile-preview-title" : undefined;
    return (
      <>
        {mode === "mobile" && (
          <div className="mobile-sheet-head">
            <span className="mobile-sheet-handle" aria-hidden="true" />
            <button className="modal-x" onClick={closeMobilePreview} aria-label="Close group preview">
              <Icon name="x" size={17} />
            </button>
          </div>
        )}

        <section className="gd-hero-card modern">
          <div
            className="gd-hero-img modern"
            style={{ backgroundImage: (groupVisuals[group.type] || groupVisuals.social).image }}
          >
            <button
              className="group-menu-btn detail"
              onClick={(event) => {
                event.stopPropagation();
                setPreviewMenuOpen((v) => !v);
              }}
            >
              <Icon name="dots" size={15} />
            </button>
            {renderPreviewMenu(group)}
          </div>

          <div className="gd-content modern">
            <div className="gd-icon-large" style={{ color: group.color }}>
              <Icon name={group.icon} size={25} />
            </div>
            <div className="gd-title-block">
              <div>
                <h2 id={titleId}>{group.name}</h2>
                <p>{group.memberIds.length} members · Created by {group.ownerId === myId ? "You" : (group.ownerUsername ?? "—")}</p>
              </div>
              <button onClick={() => editGroup(group)}><Icon name="edit" size={14} /></button>
            </div>

            <div className="gd-balance-card">
              <div>
                <span>Total Expenses</span>
                <strong>{fmt(group.total, group.currency)}</strong>
              </div>
              <div>
                <span>{group.balance < 0 ? "You owe" : "You're owed"}</span>
                <strong className={group.balance < 0 ? "neg" : "pos"}>{fmt(Math.abs(group.balance), group.currency)}</strong>
              </div>
              <div>
                <span>Progress</span>
                <strong>{settlementPct(group)}%</strong>
              </div>
            </div>

            <div className="gd-actions modern">
              <Link href={`/groups/${group.id}`} className="btn btn-primary" onClick={closeMobilePreview}>
                View Expenses
              </Link>
              <button className="btn btn-secondary" onClick={() => router.push(`/groups/${group.id}/settle`)}>
                Settle Up
              </button>
              <button className="btn btn-secondary" onClick={() => openMembers(group)}>
                Members
              </button>
            </div>
          </div>
        </section>

        <section className="rail-card modern">
          <div className="rail-head">
            <h3>Members</h3>
            <button className="rail-link" onClick={() => openMembers(group)}>Manage members</button>
          </div>
          <div className="gd-members compact">
            {group.memberIds.slice(0, 6).map((id, index) => {
              const person = personById(id);
              return (
                <div key={id} className="gd-mem">
                  <Avatar id={id} size="md" />
                  <div>
                    <div className="nm">{person.you ? person.name + " (You)" : person.name}</div>
                    <div className="role">{index === 0 ? "Admin" : "Member"}</div>
                  </div>
                  {index === 0 && <span className="member-status">Admin</span>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rail-card modern">
          <div className="rail-head">
            <h3>Recent Expenses</h3>
            <Link href={`/groups/${group.id}`} className="rail-link" onClick={closeMobilePreview}>View all</Link>
          </div>
          {previewExpenses.length === 0 ? (
            <div className="groups-mini-empty">No expenses yet.</div>
          ) : (
            previewExpenses.map((expense) => {
              const category = categoryById(expense.categoryId);
              return (
                <div key={expense.id} className="settle-row">
                  <div className="av av-md" style={{ background: category.soft, color: category.color }}>
                    <Icon name={category.icon} size={14} />
                  </div>
                  <div className="body">
                    <div className="nm">{expense.title}</div>
                    <div className="ds">{expense.date}</div>
                  </div>
                  <div className="amt num">{fmt(expense.amount, group.currency)}</div>
                </div>
              );
            })
          )}
        </section>
      </>
    );
  };

  return (
    <>
      <div className="groups-page">
        <div className="groups-hero-head">
          <div>
            <p className="eyebrow">Shared Money Spaces</p>
            <h1>Groups</h1>
            <p>Create, manage, and settle every shared expense group without losing the thread.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Icon name="plus" size={14} /> Create Group
          </button>
        </div>

        <div className="ui-stat-grid cols-4">
          {loading ? (
            <><SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard /></>
          ) : (
            <>
              <StatCard icon="groups" tone="primary" label="Active Groups"
                value={groupStats.active} sub="Ready to split" />
              <StatCard icon="wallet" tone="neutral" label="Total Spending"
                value={groupStats.total} currency={userCurrency} sub="Across all groups" />
              {/* Clickable balance shortcuts that apply a balance quick-filter */}
              <StatCard icon="upload" tone="success" label="You Are Owed"
                value={groupStats.owed} currency={userCurrency}
                sub={balanceFilter === "owed" ? "Click to clear filter" : "Click to filter"}
                onClick={() => setBalanceFilter((f) => f === "owed" ? "all" : "owed")}
                active={balanceFilter === "owed"}
                title="Show only groups where you are owed money" />
              <StatCard icon="download" tone="danger" label="You Owe"
                value={groupStats.owe} currency={userCurrency}
                sub={balanceFilter === "owe" ? "Click to clear filter" : "Click to filter"}
                onClick={() => setBalanceFilter((f) => f === "owe" ? "all" : "owe")}
                active={balanceFilter === "owe"}
                title="Show only groups where you owe money" />
            </>
          )}
        </div>

        <div className="groups-toolbar">
          <div className="search groups-search">
            <Icon name="search" size={14} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search groups or members..." />
          </div>

          <select className="dropdown groups-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}>
            <option value="all">Filter: All Types</option>
            {(Object.keys(typeLabels).filter(t => t !== "all") as GroupType[]).map((type) => (
              <option key={type} value={type}>Filter: {typeLabels[type]}</option>
            ))}
          </select>

          <select className="dropdown groups-select" value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
            <option value="recent">Sort: Recently Created</option>
            <option value="name">Sort: Name A–Z</option>
            <option value="total">Sort: Highest Spend</option>
            <option value="balance">Sort by: Biggest Balance</option>
          </select>

          <div className="filter-grow" />
          <div className="view-toggle">
            <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="Grid view">
              <Icon name="grid" size={14} />
            </button>
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="List view">
              <Icon name="list" size={14} />
            </button>
          </div>
        </div>

        <div className="groups-layout">
          <main className="groups-main">
            {(booting || loading) ? (
              <div className={view === "grid" ? "group-grid group-grid-modern" : "group-list-modern"}>
                {Array.from({ length: 6 }).map((_, i) => <SkeletonGroupCard key={i} />)}
              </div>
            ) : groups.length === 0 ? (
              <div className="groups-empty">
                <div><Icon name="groups" size={28} /></div>
                <h2>No groups yet</h2>
                <p>Create your first group and start splitting expenses with friends.</p>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                  <Icon name="plus" size={14} /> Create Group
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="groups-empty">
                <div><Icon name="search" size={28} /></div>
                <h2>No matching groups</h2>
                <p>Try a different group name, member name, or type filter.</p>
                <button className="btn btn-secondary" onClick={() => { setQuery(""); setTypeFilter("all"); }}>
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <div className={view === "grid" ? "group-grid group-grid-modern" : "group-list-modern"}>
                  {pagedGroups.map((group) => {
                    const isSel = selected ? group.id === selected.id : false;
                    const balance = balanceMeta(group.balance, group.currency);
                    const visual = groupVisuals[group.type] || groupVisuals.social;
                    const pct = settlementPct(group);
                    return (
                      <article
                        key={group.id}
                        className={"group-card group-card-modern" + (isSel ? " selected" : "") + (view === "list" ? " list" : "")}
                        onClick={() => openPreview(group)}
                      >
                        <div className="group-visual" style={{ backgroundImage: visual.image }}>
                          <span className="group-type-pill">{visual.label}</span>
                          {isSel && <span className="group-selected-pill">Selected</span>}
                          {/* P2.8 — attention dot for groups with unsettled balance */}
                          {group.balance !== 0 && (
                            <span className="group-attention-dot" title={group.balance > 0 ? "You are owed money" : "You owe money"} />
                          )}
                          <button
                            className="group-menu-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelected(group.id);
                              setCardMenuFor(cardMenuFor === group.id ? null : group.id);
                            }}
                            aria-label="Group actions"
                          >
                            <Icon name="dots" size={15} />
                          </button>
                          {renderCardMenu(group)}
                          <div className="group-hero-ic modern" style={{ color: group.color }}>
                            <Icon name={group.icon} size={24} />
                          </div>
                        </div>

                        <div className="group-body modern">
                          <div className="group-title-row">
                            <div>
                              <h2>{group.name}</h2>
                              <p>{group.memberIds.length} members · Created {group.updated}</p>
                            </div>
                            <span className={"group-balance-pill " + balance.className}>
                              {balance.label}{balance.value ? `: ${balance.value}` : ""}
                            </span>
                          </div>

                          <div className="group-card-meta">
                            <div>
                              <span>Total Expenses</span>
                              <strong className="num">{fmt(group.total, group.currency)}</strong>
                            </div>
                            <AvatarStack ids={group.memberIds} max={5} size="sm" />
                          </div>

                          {/* P1.6 — replace misleading % estimate with honest balance status */}
                          <div className="group-settlement">
                            <div>
                              <span>Balance status</span>
                              <b style={{ color: group.balance !== 0 ? (group.balance > 0 ? "var(--success)" : "var(--rose)") : "var(--ink-3)" }}>
                                {group.balance === 0 ? "✓ Settled" : group.balance > 0 ? `+${fmt(group.balance, group.currency)}` : fmt(group.balance, group.currency)}
                              </b>
                            </div>
                            <i><em style={{ width: `${pct}%`, background: group.color }} /></i>
                          </div>

                          <div className="group-card-actions">
                            <Link href={`/groups/${group.id}`} className="btn btn-primary" onClick={(event) => event.stopPropagation()}>
                              View Expenses
                            </Link>
                            <button className="btn btn-secondary" onClick={(event) => { event.stopPropagation(); openMembers(group); }}>
                              Members
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <Pagination
                    page={currentPage}
                    totalPages={totalPages}
                    onChange={setPage}
                    summary={`Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} groups`}
                  />
                )}
              </>
            )}
          </main>

          {selected && (
            <aside className="groups-detail-panel">
              <section className="gd-hero-card modern">
                <div
                  className="gd-hero-img modern"
                  style={{ backgroundImage: (groupVisuals[selected.type] || groupVisuals.social).image }}
                >
                  <button className="group-menu-btn detail" onClick={() => setPreviewMenuOpen((v) => !v)}>
                    <Icon name="dots" size={15} />
                  </button>
                  {renderPreviewMenu(selected)}
                </div>

                <div className="gd-content modern">
                  <div className="gd-icon-large" style={{ color: selected.color }}>
                    <Icon name={selected.icon} size={25} />
                  </div>
                  <div className="gd-title-block">
                    <div>
                      <h2>{selected.name}</h2>
                      <p>{selected.memberIds.length} members · Created by {selected.ownerId === myId ? "You" : (selected.ownerUsername ?? "—")}</p>
                    </div>
                    <button onClick={() => editGroup(selected)}><Icon name="edit" size={14} /></button>
                  </div>

                  <div className="gd-balance-card">
                    <div>
                      <span>Total Expenses</span>
                      <strong>{fmt(selected.total, selected.currency)}</strong>
                    </div>
                    <div>
                      <span>{selected.balance < 0 ? "You owe" : "You're owed"}</span>
                      <strong className={selected.balance < 0 ? "neg" : "pos"}>{fmt(Math.abs(selected.balance), selected.currency)}</strong>
                    </div>
                    <div>
                      <span>Progress</span>
                      <strong>{settlementPct(selected)}%</strong>
                    </div>
                  </div>

                  <div className="gd-actions modern">
                    <Link href={`/groups/${selected.id}`} className="btn btn-primary">
                      View Expenses
                    </Link>
                    <Link href={`/groups/${selected.id}/settle`} className="btn btn-secondary">
                      Settle Up
                    </Link>
                    <button className="btn btn-secondary" onClick={() => openMembers(selected)}>
                      Members
                    </button>
                  </div>
                </div>
              </section>

              <section className="rail-card modern">
                <div className="rail-head">
                  <h3>Members</h3>
                  <button className="rail-link" onClick={() => openMembers(selected)}>Manage members</button>
                </div>
                <div className="gd-members compact">
                  {selected.memberIds.slice(0, 6).map((id, index) => {
                    const person = personById(id);
                    return (
                      <div key={id} className="gd-mem">
                        <Avatar id={id} size="md" />
                        <div>
                          <div className="nm">{person.you ? person.name + " (You)" : person.name}</div>
                          <div className="role">{index === 0 ? "Admin" : "Member"}</div>
                        </div>
                        {index === 0 && <span className="member-status">Admin</span>}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rail-card modern">
                <div className="rail-head">
                  <h3>Recent Expenses</h3>
                  <Link href={`/groups/${selected.id}`} className="rail-link">View all</Link>
                </div>
                {selectedExpenses.length === 0 ? (
                  <div className="groups-mini-empty">No expenses yet.</div>
                ) : (
                  selectedExpenses.map((expense) => {
                    const category = categoryById(expense.categoryId);
                    return (
                      <div key={expense.id} className="settle-row">
                        <div className="av av-md" style={{ background: category.soft, color: category.color }}>
                          <Icon name={category.icon} size={14} />
                        </div>
                        <div className="body">
                          <div className="nm">{expense.title}</div>
                          <div className="ds">{expense.date}</div>
                        </div>
                        <div className="amt num">{fmt(expense.amount, selected?.currency)}</div>
                      </div>
                    );
                  })
                )}
              </section>
            </aside>
          )}
        </div>
      </div>

      {selected && mobilePreviewOpen && (
        <div className="mobile-preview-backdrop" onClick={closeMobilePreview}>
          <aside
            className="mobile-group-preview"
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-mobile-preview-title"
            onClick={(event) => event.stopPropagation()}
          >
            {renderGroupPreview(selected, "mobile")}
          </aside>
        </div>
      )}

      {showCreate && (
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onSubmit={(group) => {
            void createGroup(group);
            setShowCreate(false);
          }}
        />
      )}

      {showMembers && selected && (
        <ManageGroupMembersModal
          group={selected}
          onClose={() => setShowMembers(false)}
          onChanged={refetchSplitting}
          onToast={showToast}
        />
      )}

      {editingGroup && (
        <EditGroupModal
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onSaved={refetchSplitting}
          onToast={showToast}
        />
      )}
    </>
  );
}

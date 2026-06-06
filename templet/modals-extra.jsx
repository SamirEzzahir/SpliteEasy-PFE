// modals-extra.jsx — Add Expense (full splitting), Create Group, Add Friend

const { useState: mUseState, useMemo: mUseMemo, useEffect: mUseEffect, useRef: mUseRef } = React;

// ─────────────────────────────────────────────────────────────────────────────
// ADD EXPENSE — full splitting flow
// ─────────────────────────────────────────────────────────────────────────────
const AddExpenseFullModal = ({ onClose, onSubmit, defaultGroupId = "istanbul" }) => {
  const [title, setTitle] = mUseState("Dinner at Bella Italia");
  const [amount, setAmount] = mUseState("85.60");
  const [groupId, setGroupId] = mUseState(defaultGroupId);
  const [paidBy, setPaidBy] = mUseState("samir");
  const [categoryId, setCategoryId] = mUseState("food");
  const [date, setDate] = mUseState("May 29, 2025");
  const [note, setNote] = mUseState("");
  const [splitIds, setSplitIds] = mUseState(() => groupById(defaultGroupId).memberIds.slice(0, 5));
  const [splitMode, setSplitMode] = mUseState("equal"); // equal/pct/share
  const [showMore, setShowMore] = mUseState(false);

  const group = groupById(groupId);
  // when group changes, reset split list
  mUseEffect(() => {
    setSplitIds(group.memberIds.slice(0, Math.min(5, group.memberIds.length)));
    if (!group.memberIds.includes(paidBy)) setPaidBy(group.memberIds[0]);
  }, [groupId]);

  const num = parseFloat(amount) || 0;
  const perPerson = splitIds.length ? num / splitIds.length : 0;
  const perPct = splitIds.length ? 100 / splitIds.length : 0;
  const valid = title.trim() && num > 0 && splitIds.length > 0;

  const toggle = (id) => {
    setSplitIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const submit = () => {
    if (!valid) return;
    onSubmit({
      id: "e" + Date.now(),
      title: title.trim(),
      subtitle: "",
      groupId, paidBy, categoryId, amount: num, date, time: "Just now",
      splitIds: [...splitIds],
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h with-icon">
          <div className="modal-h-titlewrap">
            <div className="modal-icon"><Icon name="receipt" size={24}/></div>
            <div>
              <h2>Add New Expense</h2>
              <p>Enter expense details and split it with group members.</p>
            </div>
          </div>
          <button className="modal-x" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>

        <div className="modal-b">
          <div className="form-grid-2">
            <div className="form-block">
              <label>Expense Title</label>
              <div className="form-input">
                <Icon name="receipt" size={15} className="ic"/>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dinner at Bella Italia"/>
              </div>
            </div>
            <div className="form-block">
              <label>Amount</label>
              <div className="form-input with-after">
                <Icon name="coin" size={15} className="ic"/>
                <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}/>
                <div className="after">USD <Icon name="chev" size={12}/></div>
              </div>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-block">
              <label>Group</label>
              <div className="form-input">
                <Icon name="groups" size={15} className="ic"/>
                <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <Icon name="chev" size={12} className="ic"/>
              </div>
            </div>
            <div className="form-block">
              <label>Paid By</label>
              <div className="form-input">
                <Icon name="account" size={15} className="ic"/>
                <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                  {group.memberIds.map((id) => {
                    const p = personById(id);
                    return <option key={id} value={id}>{p.you ? p.name + " (You)" : p.name}</option>;
                  })}
                </select>
                <Icon name="chev" size={12} className="ic"/>
              </div>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-block">
              <label>Category</label>
              <div className="form-input">
                <Icon name={categoryById(categoryId).icon} size={15} className="ic" style={{ color: categoryById(categoryId).color }}/>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Icon name="chev" size={12} className="ic"/>
              </div>
            </div>
            <div className="form-block">
              <label>Date</label>
              <div className="form-input">
                <Icon name="receipt" size={15} className="ic"/>
                <input value={date} onChange={(e) => setDate(e.target.value)}/>
              </div>
            </div>
          </div>

          <div className="form-block">
            <label>Description <span className="opt">(Optional)</span></label>
            <div className="textarea-wrap">
              <div className="form-input" style={{ alignItems: "flex-start", paddingTop: 8 }}>
                <Icon name="receipt" size={15} className="ic" style={{ marginTop: 4 }}/>
                <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="Add a note about this expense..."/>
              </div>
              <div className="counter">{note.length}/200</div>
            </div>
          </div>

          {/* Split */}
          <div className="split-head">
            <label>Split Expense With</label>
            <button className="split-mode">
              <Icon name="split-equal" size={14}/> Split Equally <Icon name="chev" size={11}/>
            </button>
          </div>

          <div className="mem-rows">
            {group.memberIds.map((id) => {
              const checked = splitIds.includes(id);
              const p = personById(id);
              const isPayer = id === paidBy;
              return (
                <div key={id} className="mem-row">
                  <button className={"checkbox" + (checked ? " checked" : "")} onClick={() => toggle(id)} aria-label="select">
                    <Icon name="check" size={12}/>
                  </button>
                  <Avatar id={id} size="md"/>
                  <span className="nm">
                    {p.you ? p.name + " (You)" : p.name}
                    {isPayer && <span className="paid-tag">Paid</span>}
                  </span>
                  <span className="amt num">{checked ? fmt(perPerson) : "—"}</span>
                  <span className="pct num">{checked ? Math.round(perPct) + "%" : "—"}</span>
                </div>
              );
            })}
          </div>

          <button className="add-more-box" onClick={() => setShowMore((v) => !v)}>
            <div className="ic"><Icon name="plus" size={16}/></div>
            <div className="body">
              <div className="nm">Add More Details</div>
              <div className="ds">Add receipt, location and other details</div>
            </div>
            <Icon name="chev" size={14} style={{ color: "var(--ink-3)", transform: showMore ? "rotate(180deg)" : "none", transition: ".2s" }}/>
          </button>
          {showMore && (
            <div style={{ padding: 14, background: "#fafbfc", borderRadius: 10, marginTop: 10, fontSize: 12, color: "var(--ink-3)" }}>
              Receipt upload, location pin, and tags coming soon.
            </div>
          )}
        </div>

        <div className="modal-f">
          <div/>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!valid} onClick={submit} style={{ opacity: valid ? 1 : 0.5 }}>
              <Icon name="plus" size={14}/> Add Expense
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE GROUP
// ─────────────────────────────────────────────────────────────────────────────
const SPLIT_OPTS = [
  { id: "equal", name: "Equal Split", ds: "Split expenses equally among all members", icon: "split-equal", color: "#5b4ef0", soft: "#eeecff" },
  { id: "pct",   name: "By Percentage", ds: "Split expenses by custom percentages", icon: "split-pct", color: "#10b981", soft: "#dcfce7" },
  { id: "share", name: "By Share",      ds: "Split expenses by custom shares", icon: "split-share", color: "#f97316", soft: "#fff1e6" },
];

const CreateGroupModal = ({ onClose, onSubmit }) => {
  const [name, setName] = mUseState("Weekend Trip to Dubai");
  const [type, setType] = mUseState("trip");
  const [description, setDescription] = mUseState("Trip to Dubai with close friends for a weekend getaway.");
  const [currency, setCurrency] = mUseState("USD");
  const [memberIds, setMemberIds] = mUseState(["ahmed", "youssef", "sara", "omar"]);
  const [splitMode, setSplitMode] = mUseState("equal");
  const [anyoneAdd, setAnyoneAdd] = mUseState(true);
  const [memberQuery, setMemberQuery] = mUseState("");

  const valid = name.trim().length > 0;

  const removeMember = (id) => setMemberIds((s) => s.filter((x) => x !== id));
  const addMember = (id) => {
    if (!memberIds.includes(id)) setMemberIds((s) => [...s, id]);
    setMemberQuery("");
  };

  const candidates = PEOPLE.filter((p) => !p.you && !memberIds.includes(p.id) &&
    (memberQuery.trim() ? p.name.toLowerCase().includes(memberQuery.toLowerCase()) : false));

  const submit = () => {
    if (!valid) return;
    const typeMeta = GROUP_TYPES.find((t) => t.id === type);
    const palette = [
      { color: "#5b4ef0", soft: "#eeecff", heroA: "#7c3aed", heroB: "#f59e0b" },
      { color: "#10b981", soft: "#dcfce7", heroA: "#10b981", heroB: "#fbbf24" },
      { color: "#f97316", soft: "#fff1e6", heroA: "#f97316", heroB: "#ec4899" },
      { color: "#0ea5e9", soft: "#e0f2fe", heroA: "#0ea5e9", heroB: "#5b4ef0" },
    ][Math.floor(Math.random() * 4)];
    onSubmit({
      id: "g" + Date.now(),
      name: name.trim(),
      type,
      icon: typeMeta.icon,
      memberIds: ["samir", ...memberIds],
      total: 0, balance: 0, updated: "just now",
      ...palette,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h with-icon">
          <div className="modal-h-titlewrap">
            <div className="modal-icon"><Icon name="groups" size={24}/></div>
            <div>
              <h2>Create New Group</h2>
              <p>Add group details and invite members.</p>
            </div>
          </div>
          <button className="modal-x" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>

        <div className="modal-b">
          <div className="form-grid-2">
            <div className="form-block">
              <label>Group Name</label>
              <div className="form-input">
                <Icon name="groups" size={15} className="ic"/>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend Trip"/>
              </div>
            </div>
            <div className="form-block">
              <label>Group Type</label>
              <div className="form-input">
                <Icon name={GROUP_TYPES.find((t) => t.id === type).icon} size={15} className="ic" style={{ color: "var(--primary)" }}/>
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  {GROUP_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <Icon name="chev" size={12} className="ic"/>
              </div>
            </div>
          </div>

          <div className="form-block">
            <label>Description <span className="opt">(Optional)</span></label>
            <div className="textarea-wrap">
              <div className="form-input" style={{ alignItems: "flex-start", paddingTop: 8 }}>
                <Icon name="chat" size={15} className="ic" style={{ marginTop: 4 }}/>
                <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 200))} placeholder="What's this group for?"/>
              </div>
              <div className="counter">{description.length}/200</div>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-block">
              <label>Currency</label>
              <div className="form-input">
                <Icon name="coin" size={15} className="ic" style={{ color: "var(--primary)" }}/>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="MAD">MAD — Moroccan Dirham</option>
                </select>
                <Icon name="chev" size={12} className="ic"/>
              </div>
            </div>
            <div className="form-block">
              <label>Group Image <span className="opt">(Optional)</span></label>
              <button className="upload-box" style={{ width: "100%" }}>
                <div className="ic"><Icon name="image" size={16}/></div>
                <div>
                  <div className="nm">Click to upload or drag & drop</div>
                  <div className="sub">PNG, JPG up to 2MB</div>
                </div>
              </button>
            </div>
          </div>

          <div className="form-block">
            <label>Add Members</label>
            <div className="form-input">
              <Icon name="search" size={15} className="ic"/>
              <input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Search by name or email..."/>
            </div>
            {candidates.length > 0 && (
              <div style={{ marginTop: 8, padding: 8, background: "#fafbfc", border: "1px solid var(--line-2)", borderRadius: 10, maxHeight: 160, overflow: "auto" }}>
                {candidates.slice(0, 5).map((p) => (
                  <button key={p.id} onClick={() => addMember(p.id)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", width: "100%", border: 0, background: "transparent", borderRadius: 6, cursor: "pointer", textAlign: "left" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "white")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <Avatar id={p.id} size="sm"/>
                    <span style={{ fontSize: 13 }}>{p.name}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="member-chips">
              {memberIds.map((id) => {
                const p = personById(id);
                return (
                  <span key={id} className="chip">
                    <Avatar id={id} size="sm"/>
                    <span className="chip-nm">{p.name}</span>
                    <button className="chip-x" onClick={() => removeMember(id)}><Icon name="x" size={10}/></button>
                  </span>
                );
              })}
            </div>
          </div>

          <div className="form-block">
            <label>Default Expense Split</label>
            <div className="split-options">
              {SPLIT_OPTS.map((o) => (
                <button key={o.id} className={"split-opt" + (splitMode === o.id ? " active" : "")} onClick={() => setSplitMode(o.id)}>
                  <div className="split-opt-ic" style={{ background: o.soft, color: o.color }}>
                    <Icon name={o.icon} size={18}/>
                  </div>
                  <div className="nm">{o.name}</div>
                  <div className="ds">{o.ds}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="toggle-row">
            <div>
              <div className="nm">Anyone can add expenses</div>
              <div className="ds">Allow all group members to add expenses</div>
            </div>
            <button className={"switch switch-light" + (anyoneAdd ? " on" : "")} onClick={() => setAnyoneAdd((v) => !v)}/>
          </div>
        </div>

        <div className="modal-f">
          <div/>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!valid} onClick={submit} style={{ opacity: valid ? 1 : 0.5 }}>
              <Icon name="userPlus" size={14}/> Create Group
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ADD FRIEND
// ─────────────────────────────────────────────────────────────────────────────
const AddFriendModal = ({ existingFriends, onClose, onAdd }) => {
  const [query, setQuery] = mUseState("");
  const [pending, setPending] = mUseState(new Set());

  const existingIds = new Set(existingFriends.map((f) => f.personId));
  const candidates = PEOPLE.filter((p) => !p.you && !existingIds.has(p.id));
  const filtered = query.trim()
    ? candidates.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.email || "").toLowerCase().includes(query.toLowerCase()))
    : candidates.slice(0, 5);

  const toggleAdd = (id) => {
    const next = new Set(pending);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPending(next);
  };

  const done = () => {
    onAdd([...pending]);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h with-icon">
          <div className="modal-h-titlewrap">
            <div className="modal-icon"><Icon name="userPlus" size={24}/></div>
            <div>
              <h2>Add Friend</h2>
              <p>Search and add friends to start splitting expenses.</p>
            </div>
          </div>
          <button className="modal-x" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>

        <div className="modal-b">
          <div className="fr-search-box">
            <Icon name="search" size={16}/>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email or phone number"/>
          </div>

          <div className="fr-sec-h">
            {query.trim() ? `Search results (${filtered.length})` : "Suggested Friends"}
          </div>
          <div className="fr-sug-list">
            {filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                No matches found.
              </div>
            ) : filtered.map((p) => {
              const isPending = pending.has(p.id);
              return (
                <div key={p.id} className="fr-sug-row">
                  <Avatar id={p.id} size="md"/>
                  <div>
                    <div className="nm">{p.name}</div>
                    <div className="sub">{p.email}</div>
                  </div>
                  <button className={"btn-add-sm" + (isPending ? " pending" : "")} onClick={() => toggleAdd(p.id)}
                    style={isPending ? { background: "var(--primary)", color: "white" } : {}}>
                    <Icon name={isPending ? "check" : "plus"} size={11}/>
                    {isPending ? " Added" : " Add"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="fr-sec-h">Other Options</div>
          <div className="fr-invite-grid">
            <button className="fr-invite-card">
              <div className="ic" style={{ background: "#eeecff", color: "#5b4ef0" }}><Icon name="mail" size={18}/></div>
              <div>
                <div className="nm">Invite via Email</div>
                <div className="ds">Send an invitation to your friend's email</div>
              </div>
              <Icon name="chevR" size={14} className="chev"/>
            </button>
            <button className="fr-invite-card">
              <div className="ic" style={{ background: "#dcfce7", color: "#10b981" }}><Icon name="phone" size={18}/></div>
              <div>
                <div className="nm">Invite via Phone</div>
                <div className="ds">Send an invitation via phone number</div>
              </div>
              <Icon name="chevR" size={14} className="chev"/>
            </button>
          </div>
        </div>

        <div className="modal-f">
          <div/>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={done}>
              Done {pending.size > 0 && `(${pending.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { AddExpenseFullModal, CreateGroupModal, AddFriendModal });

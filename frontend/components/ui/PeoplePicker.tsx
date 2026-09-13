"use client";

import { useId, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import Icon from "@/components/Icon";
import { personById } from "@/lib/data";
import type { Person } from "@/lib/types";

interface PeoplePickerProps {
  title: string;
  headingId?: string;
  description?: string;
  people: Person[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  currentUserId?: string;
  disabled?: boolean;
}

export function PeoplePicker({
  title, headingId, description, people, selectedIds, onChange, currentUserId, disabled = false,
}: PeoplePickerProps) {
  const id = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const labelId = headingId || `${id}-heading`;
  const displayName = (person: Person) => person.id === currentUserId ? "You" : person.name;
  const availablePeople = people.filter((person) => !selectedIds.includes(person.id));
  const candidates = availablePeople.filter((person) =>
    `${displayName(person)} ${person.name} ${person.email || ""}`.toLowerCase().includes(normalizedQuery));

  function clearSearch() {
    setQuery("");
    searchRef.current?.focus();
  }

  function addPerson(personId: string) {
    if (!selectedIds.includes(personId)) onChange([...selectedIds, personId]);
    clearSearch();
  }

  function removePerson(personId: string) {
    onChange(selectedIds.filter((selectedId) => selectedId !== personId));
    searchRef.current?.focus();
  }

  return (
    <div className="people-picker cg-members-panel" role="group" aria-labelledby={labelId}>
      <div className="cg-members-head">
        <div>
          <h3 id={labelId}>{title}</h3>
          {description && <span>{description}</span>}
          <span role="status" className={description ? "sr-only" : undefined}>{selectedIds.length} selected</span>
        </div>
        <div className="cg-member-actions">
          <button type="button" disabled={disabled || !availablePeople.length} onClick={() => {
            onChange(Array.from(new Set([...selectedIds, ...people.map((person) => person.id)])));
            clearSearch();
          }}>Select All</button>
          <button type="button" disabled={disabled || !selectedIds.length} onClick={() => {
            onChange([]);
            clearSearch();
          }}>Clear All</button>
        </div>
      </div>

      <div className="form-input cg-member-search">
        <span aria-hidden="true"><Icon name="search" size={15} className="ic" /></span>
        <input
          ref={searchRef}
          id={`${id}-search`}
          type="search"
          aria-label="Search by name or email"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
          placeholder="Search by name or email..."
        />
      </div>

      <div className="cg-friend-grid">
        {candidates.length === 0 ? (
          <div className="cg-empty-friends">
            <span aria-hidden="true"><Icon name={!people.length ? "groups" : !availablePeople.length ? "check" : "search"} size={20} /></span>
            <p role="status">{!people.length ? "No people available yet." : !availablePeople.length
              ? "Everyone is selected." : "No matching people found."}</p>
            {normalizedQuery && <button type="button" className="btn btn-secondary people-picker-clear-search" disabled={disabled} onClick={clearSearch}>Clear search</button>}
          </div>
        ) : candidates.map((person) => (
          <button key={person.id} type="button" className="cg-friend-card" disabled={disabled}
            aria-label={`Add ${displayName(person)}`} onClick={() => addPerson(person.id)}>
            <span aria-hidden="true"><Avatar id={person.id} size="md" /></span>
            <span>{displayName(person)}</span>
            <small>Add</small>
          </button>
        ))}
      </div>

      {selectedIds.length > 0 && (
        <div className="member-chips cg-selected-members">
          {selectedIds.map((personId) => {
            const person = people.find((candidate) => candidate.id === personId) || personById(personId);
            return (
              <span key={personId} className="chip">
                <span aria-hidden="true"><Avatar id={personId} size="sm" /></span>
                <span className="chip-nm">{displayName(person)}</span>
                <button type="button" className="chip-x" disabled={disabled}
                  aria-label={`Remove ${displayName(person)}`} onClick={() => removePerson(personId)}>
                  <Icon name="x" size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

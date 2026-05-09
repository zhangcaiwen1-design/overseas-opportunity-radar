import { describe, expect, it } from 'vitest';
import {
  applyBulkSelection,
  buildDraftSortOrderUpdates,
  buildSelectedCandidateDraft,
  filterAndSortCandidates,
  moveSelectedCandidate,
} from '../app/dashboardSelection';

describe('buildSelectedCandidateDraft', () => {
  it('returns selected candidates in the current manual order', () => {
    const selected = buildSelectedCandidateDraft(
      [
        {
          id: 'candidate-1',
          title: 'Alpha',
          source: 'github',
          summary: 'summary',
          rank: 1,
          draftSortOrder: 1,
          selectionState: 'selected',
          tags: ['ops'],
          canonicalUrl: 'https://example.com/alpha',
        },
        {
          id: 'candidate-2',
          title: 'Beta',
          source: 'rss',
          summary: 'summary',
          rank: 2,
          draftSortOrder: 0,
          selectionState: 'selected',
          tags: ['ai'],
          canonicalUrl: 'https://example.com/beta',
        },
      ],
      ['candidate-2', 'candidate-1'],
    );

    expect(selected.map((candidate) => candidate.id)).toEqual(['candidate-2', 'candidate-1']);
  });

  it('falls back to persisted draft sort order when no local draft exists', () => {
    const selected = buildSelectedCandidateDraft(
      [
        {
          id: 'candidate-1',
          title: 'Alpha',
          source: 'github',
          summary: 'summary',
          rank: 1,
          draftSortOrder: 2,
          selectionState: 'selected',
          tags: ['ops'],
          canonicalUrl: 'https://example.com/alpha',
        },
        {
          id: 'candidate-2',
          title: 'Beta',
          source: 'rss',
          summary: 'summary',
          rank: 2,
          draftSortOrder: 0,
          selectionState: 'selected',
          tags: ['ai'],
          canonicalUrl: 'https://example.com/beta',
        },
        {
          id: 'candidate-3',
          title: 'Gamma',
          source: 'github',
          summary: 'summary',
          rank: 3,
          draftSortOrder: 1,
          selectionState: 'selected',
          tags: ['ops'],
          canonicalUrl: 'https://example.com/gamma',
        },
      ],
      [],
    );

    expect(selected.map((candidate) => candidate.id)).toEqual(['candidate-2', 'candidate-3', 'candidate-1']);
  });
});

describe('moveSelectedCandidate', () => {
  it('moves the selected candidate up or down within the draft order', () => {
    expect(moveSelectedCandidate(['candidate-1', 'candidate-2', 'candidate-3'], 'candidate-2', 'up')).toEqual([
      'candidate-2',
      'candidate-1',
      'candidate-3',
    ]);
    expect(moveSelectedCandidate(['candidate-1', 'candidate-2', 'candidate-3'], 'candidate-2', 'down')).toEqual([
      'candidate-1',
      'candidate-3',
      'candidate-2',
    ]);
  });
});

describe('buildDraftSortOrderUpdates', () => {
  it('builds contiguous draft sort order updates from the current selected order', () => {
    expect(buildDraftSortOrderUpdates(['candidate-2', 'candidate-3', 'candidate-1'])).toEqual([
      { candidateId: 'candidate-2', draftSortOrder: 0 },
      { candidateId: 'candidate-3', draftSortOrder: 1 },
      { candidateId: 'candidate-1', draftSortOrder: 2 },
    ]);
  });
});

describe('filterAndSortCandidates', () => {
  it('filters by selection state and sorts by requested mode after searching', () => {
    const rows = filterAndSortCandidates({
      candidates: [
        {
          id: 'candidate-1',
          title: 'Gamma',
          source: 'github',
          summary: 'developer workflow',
          rank: 3,
          selectionState: 'pending',
          tags: ['ops'],
          canonicalUrl: 'https://example.com/gamma',
        },
        {
          id: 'candidate-2',
          title: 'Alpha',
          source: 'rss',
          summary: 'developer workflow',
          rank: 1,
          selectionState: 'selected',
          tags: ['ai'],
          canonicalUrl: 'https://example.com/alpha',
        },
        {
          id: 'candidate-3',
          title: 'Beta',
          source: 'github',
          summary: 'other topic',
          rank: 2,
          selectionState: 'discarded',
          tags: ['ops'],
          canonicalUrl: 'https://example.com/beta',
        },
      ],
      searchQuery: 'developer',
      selectionFilter: 'all',
      sortMode: 'title-asc',
    });

    expect(rows.map((candidate) => candidate.id)).toEqual(['candidate-2', 'candidate-1']);

    const selectedOnly = filterAndSortCandidates({
      candidates: rows,
      searchQuery: '',
      selectionFilter: 'selected',
      sortMode: 'rank-asc',
    });

    expect(selectedOnly.map((candidate) => candidate.id)).toEqual(['candidate-2']);
  });
});

describe('applyBulkSelection', () => {
  it('keeps existing selected order and appends newly selected visible candidates', () => {
    const next = applyBulkSelection({
      selectedCandidateIds: ['candidate-3'],
      visibleCandidateIds: ['candidate-1', 'candidate-2', 'candidate-3'],
      action: 'select',
    });

    expect(next).toEqual(['candidate-3', 'candidate-1', 'candidate-2']);
  });

  it('removes the visible candidates from the draft when bulk discarding the page', () => {
    const next = applyBulkSelection({
      selectedCandidateIds: ['candidate-1', 'candidate-2', 'candidate-4'],
      visibleCandidateIds: ['candidate-1', 'candidate-2', 'candidate-3'],
      action: 'discard',
    });

    expect(next).toEqual(['candidate-4']);
  });
});

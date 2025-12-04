# Admin Voting Report Specification

## Overview

The admin page should display aggregate voting statistics to understand community preferences for sources and categories.

## Purpose

- **Transparency**: See what the community values or dislikes
- **Content Strategy**: Identify which sources/categories to prioritize or deprioritize
- **Quality Control**: Detect issues with specific sources

## Display Requirements

### Section 1: Source Weights

**Title**: "Community Source Preferences"

**Table Columns**:

1. **Source Name** - The domain or source name (e.g., "TechCrunch", "Bloomberg")
2. **Net Votes** - Total upvotes minus downvotes
3. **Upvotes** - Total number of upvotes
4. **Downvotes** - Total number of downvotes
5. **Total Stories** - Number of stories from this source with any votes
6. **Current Multiplier** - The community multiplier (1 + NetVotes × 0.02), clamped to [0.8, 1.2]

**Sorting**: Descending by Net Votes (most positive at top, most negative at bottom)

**Example**:

| Source | Net Votes | ↑ | ↓ | Stories | Multiplier |
|--------|-----------|---|---|---------|------------|
| TechCrunch | +12 | 15 | 3 | 8 | 1.20 (max) |
| Bloomberg | +5 | 7 | 2 | 4 | 1.10 |
| The Verge | 0 | 2 | 2 | 3 | 1.00 |
| CoinDesk | -3 | 1 | 4 | 2 | 0.94 |
| Unknown | -8 | 0 | 8 | 5 | 0.84 |

### Section 2: Category Weights

**Title**: "Community Category Preferences"

**Table Columns**:

1. **Category** - The sector/industry tag (e.g., "SaaS", "AI", "FinTech")
2. **Net Votes** - Total upvotes minus downvotes for stories in this category
3. **Upvotes** - Total number of upvotes
4. **Downvotes** - Total number of downvotes
5. **Total Stories** - Number of stories with this category that received votes
6. **Current Multiplier** - The community multiplier (1 + NetVotes × 0.02), clamped to [0.8, 1.2]

**Sorting**: Descending by Net Votes

**Example**:

| Category | Net Votes | ↑ | ↓ | Stories | Multiplier |
|----------|-----------|---|---|---------|------------|
| AI/ML | +18 | 20 | 2 | 12 | 1.20 (max) |
| SaaS | +10 | 12 | 2 | 9 | 1.20 (max) |
| FinTech | +3 | 5 | 2 | 4 | 1.06 |
| E-commerce | -2 | 3 | 5 | 6 | 0.96 |
| Crypto | -7 | 2 | 9 | 8 | 0.86 |

## Technical Implementation

### Data Aggregation

**API Endpoint**: `GET /api/admin/voting-report`

**Response Format**:

```json
{
  "sources": [
    {
      "name": "TechCrunch",
      "netVotes": 12,
      "upvotes": 15,
      "downvotes": 3,
      "storyCount": 8,
      "multiplier": 1.2
    }
  ],
  "categories": [
    {
      "name": "AI/ML",
      "netVotes": 18,
      "upvotes": 20,
      "downvotes": 2,
      "storyCount": 12,
      "multiplier": 1.2
    }
  ],
  "metadata": {
    "totalFeedback": 50,
    "dateRange": "All time",
    "lastUpdated": "2025-12-03T20:19:00Z"
  }
}
```

### Calculation Logic

1. **Fetch all feedback** from the `feedback` collection (enriched with story data)
2. **For Sources**:
   - Group by `source_domain` or `source`
   - Count upvotes (`rating === 'up'`)
   - Count downvotes (`rating === 'down'`)
   - Calculate `netVotes = upvotes - downvotes`
   - Calculate `multiplier = Math.max(0.8, Math.min(1.2, 1 + (netVotes * 0.02)))`
3. **For Categories**:
   - For each feedback item, iterate through its `sectors` array
   - Group by sector/category
   - Same vote counting and multiplier calculation as sources
4. **Sort** both lists by `netVotes` descending

### UI Layout

**Location**: New tab/section in the admin page

**Navigation**: Add "Voting Report" button/tab next to "Send Newsletter" and "AI Guidance"

**Visual Design**:

- Use tables with sortable columns
- Color-code rows:
  - Green tint for positive net votes
  - Red tint for negative net votes
  - Neutral/white for zero
- Highlight clamped multipliers (at 0.8 or 1.2 bounds)

## Future Enhancements

- Date range filter (last 7 days, 30 days, all time)
- Per-user breakdown (see individual voting patterns)
- Export to CSV
- Trends over time (chart showing how preferences change)

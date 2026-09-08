export type SearchTab = "search" | "history";

export type SearchSenderFilter = "anyone" | "me" | "partner";
export type SearchTypeFilter =
  | "all"
  | "text"
  | "links"
  | "photos"
  | "videos"
  | "voice"
  | "stickers"
  | "doodles"
  | "calls"
  | "music";

export type SearchFiltersState = {
  sender: SearchSenderFilter;
  from: string;
  to: string;
  type: SearchTypeFilter;
};

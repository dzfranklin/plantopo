export interface MapMeta {
  id: number;
  name: string;
  createdAt: string;
  owner: {
    id: number;
    username: string;
  };
}

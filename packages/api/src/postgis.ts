import { customType } from "drizzle-orm/pg-core";

export const geometry = customType<{ data: string }>({
  dataType() {
    return "geometry(LineString,4326)";
  },
});

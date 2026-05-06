import "../env/load.js";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer } from "@testcontainers/redis";
import { Wait } from "testcontainers";

import { setupDb } from "./setup-db.js";

export async function setup() {
  const [pg, redis] = await Promise.all([
    new PostgreSqlContainer("postgis/postgis:18-3.6")
      .withUsername("postgres")
      .withPassword("postgres")
      .withDatabase("plantopo_test")
      .withReuse()
      .withWaitStrategy(
        Wait.forAll([
          Wait.forLogMessage(
            /database system is ready to accept connections/,
            2,
          ),
          Wait.forSuccessfulCommand("pg_isready -U postgres"),
        ]),
      )
      .start(),
    new RedisContainer("redis:7-alpine").withReuse().start(),
  ]);

  const databaseUrl = pg.getConnectionUri();
  const redisUrl = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;

  process.env.DATABASE_URL = databaseUrl;
  process.env.REDIS_URL = redisUrl;

  await setupDb(databaseUrl);

  // If TESTCONTAINERS_REUSE_ENABLE is set, containers are not stopped
}

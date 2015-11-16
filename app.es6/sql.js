export default {
  create: {
    tables: [
      `CREATE TABLE info (
         key CHAR(100) PRIMARY KEY,
         value TEXT NOT NULL)`,
      `CREATE TABLE preload_type (
         id SERIAL PRIMARY KEY,
         name TEXT NOT NULL,
         values TEXT NOT NULL)`,
      `CREATE TABLE preload (
         id SERIAL PRIMARY KEY,
         preload_type_id INTEGER NOT NULL REFERENCES preload_type (id),
         data TEXT NOT NULL)`
    ],
    indices: [
      `CREATE INDEX ON preload_type (name)`,
      `CREATE UNIQUE INDEX ON preload_type (name, values)`,
      `CREATE INDEX ON preload (preload_type_id)`
    ]
  },
  insert: {
    info: {
      row: `INSERT INTO info
              (key, value)
            VALUES
              ($1, $2)`
    },
    preloadType: {
      row: `INSERT INTO preload_type
              (name, values)
            VALUES
              ($1, $2)
            RETURNING id`
    },
    preload: {
      row: `INSERT INTO preload
              (preload_type_id, data)
            VALUES
              ($1, $2)`
    }
  },
  select: {
    tablesCount: `SELECT
                    COUNT(*)
                  FROM
                    information_schema.tables
                  WHERE
                    table_name = ANY($1)`,
    info: {
      value: `SELECT
                value
              FROM
                info
              WHERE
                key = $1`
    },
    preloadType: {
      values: `SELECT
                 id, values
               FROM
                 preload_type
               WHERE
                 name = $1`
    },
    preload: {
      count: `SELECT
                COUNT(*)
              FROM
                preload
              INNER JOIN
                preload_type ON preload.preload_type_id = preload_type.id
              WHERE
                preload_type.name = $1`
    }
  },
  update: {
  },
  delete: {
    preloadType: {
      empty: `DELETE FROM
                preload_type
              WHERE
                id IN (SELECT
                         id
                       FROM
                         preload_type
                       WHERE
                         id NOT IN (SELECT
                                      DISTINCT(preload_type_id)
                                    FROM
                                      preload))`

    },
    preload: {
      getOne: `DELETE FROM
                 preload
               WHERE
                 id = (SELECT
                         id
                       FROM
                         preload
                       OFFSET
                         floor(random() * (SELECT
                                             COUNT(*)
                                           FROM
                                             preload
                                           WHERE
                                             preload_type_id = $1))
                       LIMIT
                         1)
               RETURNING
                 data`
    }
  }
}

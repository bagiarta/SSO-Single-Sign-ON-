const sql = require('mssql');
const config = {
  user: 'PEPITO_SSO',
  password: 'PEPITO_SSO',
  server: '192.168.85.29',
  port: 1433,
  database: 'SSO_PPT',
  options: { encrypt: false, trustServerCertificate: true }
};

sql.connect(config).then(pool => {
  return pool.request().query(`
    SELECT name 
    FROM sys.columns 
    WHERE object_id = OBJECT_ID('authorization_codes') 
      AND name = 'session_id'
  `);
}).then(result => {
  if (result.recordset.length === 0) {
    console.log("session_id is MISSING. Fixing it now...");
    const pool = new sql.ConnectionPool(config);
    return pool.connect().then(p => 
      p.request().query("ALTER TABLE authorization_codes ADD session_id UNIQUEIDENTIFIER NULL")
    ).then(() => {
      console.log("SUCCESS: session_id column added to authorization_codes.");
      process.exit(0);
    });
  } else {
    console.log("session_id ALREADY EXISTS.");
    process.exit(0);
  }
}).catch(err => {
  console.error("DB ERROR:", err.message);
  process.exit(1);
});

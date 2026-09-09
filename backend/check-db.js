const sql = require('mssql');
const config = {
  user: 'sa',
  password: 'Password123!',
  server: '127.0.0.1',
  database: 'sso_db',
  options: { encrypt: false, trustServerCertificate: true }
};

sql.connect(config).then(pool => {
  return pool.request().query("SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('authorization_codes')");
}).then(result => {
  console.log("COLUMNS IN authorization_codes:");
  result.recordset.forEach(row => console.log(row.name));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});

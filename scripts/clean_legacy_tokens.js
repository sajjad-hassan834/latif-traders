const fs = require('fs');

// 1. Clean Login.jsx
let login = fs.readFileSync('client/src/pages/Login.jsx', 'utf8');
login = login.replace(/border:\s*'1px solid #0266FE',/g, "border: 'none',");
login = login.replace(/onMouseEnter=\{e => e\.currentTarget\.style\.background = '#0052cc'\}/g, "onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.95)'}");
login = login.replace(/onMouseLeave=\{e => e\.currentTarget\.style\.background = '#0266FE'\}/g, "onMouseLeave={e => e.currentTarget.style.filter = 'none'}");
login = login.replace(/borderBottom:\s*forgotTab === 'request' \? '2px solid #0266FE' : '2px solid transparent'/g, "borderBottom: forgotTab === 'request' ? '2px solid var(--primary, #0F4D3A)' : '2px solid transparent'");
login = login.replace(/color:\s*forgotTab === 'request' \? '#0266FE' : '#64748b'/g, "color: forgotTab === 'request' ? 'var(--primary, #0F4D3A)' : '#64748b'");
login = login.replace(/borderBottom:\s*forgotTab === 'status' \? '2px solid #0266FE' : '2px solid transparent'/g, "borderBottom: forgotTab === 'status' ? '2px solid var(--primary, #0F4D3A)' : '2px solid transparent'");
login = login.replace(/color:\s*forgotTab === 'status' \? '#0266FE' : '#64748b'/g, "color: forgotTab === 'status' ? 'var(--primary, #0F4D3A)' : '#64748b'");
login = login.replace(/background:\s*tokenCopied \? '#15803d' : '#0266FE'/g, "background: tokenCopied ? '#15803d' : 'var(--primary, #0F4D3A)'");
login = login.replace(/background:\s*'#0266FE'/g, "background: 'var(--primary, #0F4D3A)'");
fs.writeFileSync('client/src/pages/Login.jsx', login);

// 2. Clean Users.jsx
let users = fs.readFileSync('client/src/pages/Users.jsx', 'utf8');
users = users.replace(/border:\s*'2px dashed #0266FE'/g, "border: '2px dashed var(--primary, #0F4D3A)'");
users = users.replace(/background:\s*copiedTempPassword \? '#15803d' : '#0266FE'/g, "background: copiedTempPassword ? '#15803d' : 'var(--primary, #0F4D3A)'");
fs.writeFileSync('client/src/pages/Users.jsx', users);

console.log('Login.jsx and Users.jsx cleaned of legacy blue hexes');

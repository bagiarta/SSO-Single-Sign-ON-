import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, FormControl, FormControlLabel,
  Grid, InputLabel, MenuItem, Paper, Select, Stack, Switch, TextField, Typography,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon, CheckCircle as CheckCircleIcon, ContentCopy as ContentCopyIcon,
  Lock as LockIcon, SettingsEthernet as SettingsEthernetIcon, Tune as TuneIcon
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_BASE_URL || '/sso-api';

interface ClientConfiguration {
  protocol: 'oidc' | 'oauth2';
  environment: 'production' | 'staging' | 'development';
  postLogoutRedirectUri: string;
  backchannelLogoutUri: string;
  allowedOrigins: string;
  pkceRequired: boolean;
  clientAuthentication: 'client_secret_post' | 'client_secret_basic';
  scopes: string;
  accessTokenTtl: number;
  refreshTokenEnabled: boolean;
  claimMapping: { subject: string; email: string; name: string; groups: string };
}

const defaultConfiguration: ClientConfiguration = {
  protocol: 'oidc', environment: 'development', postLogoutRedirectUri: '', backchannelLogoutUri: '', allowedOrigins: '',
  pkceRequired: true, clientAuthentication: 'client_secret_basic', scopes: 'openid profile email',
  accessTokenTtl: 3600, refreshTokenEnabled: true,
  claimMapping: { subject: 'sub', email: 'email', name: 'name', groups: 'groups' }
};

const parseJson = <T,>(value: unknown, fallback: T): T => {
  if (!value) return fallback;
  try { return typeof value === 'string' ? JSON.parse(value) : value as T; } catch { return fallback; }
};

export const ClientForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  const [formData, setFormData] = useState({ name: '', description: '', redirect_uris: '', status: 'active', access_type: 'restricted' });
  const [configuration, setConfiguration] = useState<ClientConfiguration>(defaultConfiguration);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [secretDialog, setSecretDialog] = useState({ open: false, secret: '', clientId: '' });

  useEffect(() => { if (id) fetchClient(); }, [id]);

  const fetchClient = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/clients/${id}`);
      const uris = parseJson<string[]>(data.redirect_uris, [data.redirect_uris].filter(Boolean));
      setFormData({ name: data.name || '', description: data.description || '', redirect_uris: uris.join('\n'), status: data.status || 'active', access_type: data.access_type || 'restricted' });
      setConfiguration({ ...defaultConfiguration, ...parseJson<Partial<ClientConfiguration>>(data.configuration, {}) });
    } catch { setError('Gagal memuat konfigurasi client.'); } finally { setLoading(false); }
  };

  const updateConfig = <K extends keyof ClientConfiguration>(key: K, value: ClientConfiguration[K]) =>
    setConfiguration(current => ({ ...current, [key]: value }));
  const updateClaim = (key: keyof ClientConfiguration['claimMapping'], value: string) =>
    setConfiguration(current => ({ ...current, claimMapping: { ...current.claimMapping, [key]: value } }));

  const uriCount = useMemo(() => formData.redirect_uris.split('\n').map(v => v.trim()).filter(Boolean).length, [formData.redirect_uris]);
  const copy = async (value: string) => { await navigator.clipboard?.writeText(value); setSaved(true); };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setLoading(true);
    try {
      const payload = {
        ...formData,
        redirect_uris: formData.redirect_uris.split('\n').map(uri => uri.trim()).filter(Boolean),
        configuration
      };
      const response = isEditMode ? await axios.put(`${API_URL}/clients/${id}`, payload) : await axios.post(`${API_URL}/clients`, payload);
      if (!isEditMode) setSecretDialog({ open: true, clientId: response.data.client_id, secret: response.data.client_secret });
      else navigate('/clients');
    } catch (err: any) { setError(err.response?.data?.error || 'Gagal menyimpan konfigurasi client.'); } finally { setLoading(false); }
  };

  if (loading && isEditMode && !formData.name) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}><CircularProgress /></Box>;

  return <Box component="form" onSubmit={handleSubmit}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/clients')}>Client Applications</Button>
    </Stack>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
      <Box><Typography variant="h4" sx={{ fontWeight: 700 }}>{isEditMode ? 'Edit client configuration' : 'Register client application'}</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>Siapkan semua parameter yang dibutuhkan aplikasi untuk terhubung ke SSO Server.</Typography></Box>
      <Chip icon={<CheckCircleIcon />} label="Configuration guide" color="success" variant="outlined" />
    </Box>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
    {saved && <Alert severity="success" onClose={() => setSaved(false)} sx={{ mb: 3 }}>Nilai berhasil disalin ke clipboard.</Alert>}

    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
          <SectionTitle icon={<TuneIcon />} title="1. Application identity" subtitle="Informasi dasar untuk mengenali client di SSO Server." />
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={5}><TextField fullWidth required label="Application name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></Grid>
            <Grid item xs={6} md={3}><FormControl fullWidth><InputLabel>Status</InputLabel><Select label="Status" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}><MenuItem value="active">Active</MenuItem><MenuItem value="disabled">Disabled</MenuItem></Select></FormControl></Grid>
            <Grid item xs={6} md={4}><FormControl fullWidth><InputLabel>Access Type</InputLabel><Select label="Access Type" value={formData.access_type} onChange={e => setFormData({ ...formData, access_type: e.target.value })}><MenuItem value="restricted">Restricted (GBAC)</MenuItem><MenuItem value="public">Public (All Users)</MenuItem></Select></FormControl></Grid>
            <Grid item xs={12}><TextField fullWidth label="Description" multiline minRows={2} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Contoh: Portal HR untuk karyawan internal" /></Grid>
          </Grid>
        </Paper>

        <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
          <SectionTitle icon={<SettingsEthernetIcon />} title="2. Protocol & endpoints" subtitle="Tentukan bagaimana aplikasi memulai dan mengakhiri login." />
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}><FormControl fullWidth><InputLabel>Protocol</InputLabel><Select label="Protocol" value={configuration.protocol} onChange={e => updateConfig('protocol', e.target.value as ClientConfiguration['protocol'])}><MenuItem value="oidc">OpenID Connect (recommended)</MenuItem><MenuItem value="oauth2">OAuth 2.0</MenuItem></Select></FormControl></Grid>
            <Grid item xs={12} md={6}><FormControl fullWidth><InputLabel>Environment</InputLabel><Select label="Environment" value={configuration.environment} onChange={e => updateConfig('environment', e.target.value as ClientConfiguration['environment'])}><MenuItem value="development">Development</MenuItem><MenuItem value="staging">Staging</MenuItem><MenuItem value="production">Production</MenuItem></Select></FormControl></Grid>
            <Grid item xs={12}><TextField fullWidth required label="Authorized redirect URIs" multiline minRows={3} value={formData.redirect_uris} onChange={e => setFormData({ ...formData, redirect_uris: e.target.value })} placeholder="https://app.example.com/auth/callback\nhttp://localhost:3000/auth/callback" helperText={`${uriCount} URI terdaftar. Satu URI per baris; gunakan HTTPS untuk production.`} /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label="Post-logout redirect URI" value={configuration.postLogoutRedirectUri} onChange={e => updateConfig('postLogoutRedirectUri', e.target.value)} placeholder="https://app.example.com" /></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label="Allowed origins" value={configuration.allowedOrigins} onChange={e => updateConfig('allowedOrigins', e.target.value)} placeholder="https://app.example.com" helperText="Pisahkan origin dengan koma." /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Back-channel logout URI" value={configuration.backchannelLogoutUri} onChange={e => updateConfig('backchannelLogoutUri', e.target.value)} placeholder="https://app.example.com/api/sso/backchannel-logout" helperText="SSO akan POST ke URL ini saat session lama direvoke. Aplikasi client harus menghapus session lokalnya." /></Grid>
          </Grid>
        </Paper>

        <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
          <SectionTitle icon={<LockIcon />} title="3. Security & token policy" subtitle="Atur cara client melakukan autentikasi dan lifecycle token." />
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}><FormControl fullWidth><InputLabel>Client authentication</InputLabel><Select label="Client authentication" value={configuration.clientAuthentication} onChange={e => updateConfig('clientAuthentication', e.target.value as ClientConfiguration['clientAuthentication'])}><MenuItem value="client_secret_basic">Client secret in header</MenuItem><MenuItem value="client_secret_post">Client secret in request body</MenuItem></Select></FormControl></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth type="number" label="Access token TTL (seconds)" value={configuration.accessTokenTtl} onChange={e => updateConfig('accessTokenTtl', Number(e.target.value))} inputProps={{ min: 300, max: 86400 }} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Scopes" value={configuration.scopes} onChange={e => updateConfig('scopes', e.target.value)} helperText="Contoh: openid profile email groups. Pisahkan dengan spasi." /></Grid>
            <Grid item xs={12} sm={6}><FormControlLabel control={<Switch checked={configuration.pkceRequired} onChange={e => updateConfig('pkceRequired', e.target.checked)} />} label="Require PKCE (recommended)" /></Grid>
            <Grid item xs={12} sm={6}><FormControlLabel control={<Switch checked={configuration.refreshTokenEnabled} onChange={e => updateConfig('refreshTokenEnabled', e.target.checked)} />} label="Allow refresh token" /></Grid>
          </Grid>
        </Paper>

        <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
          <SectionTitle title="4. Claim mapping" subtitle="Samakan nama claim dari SSO dengan field yang dibaca aplikasi client." />
          <Grid container spacing={2.5}>{(['subject', 'email', 'name', 'groups'] as const).map(key => <Grid item xs={12} sm={6} key={key}><TextField fullWidth label={`${key.charAt(0).toUpperCase()}${key.slice(1)} claim`} value={configuration.claimMapping[key]} onChange={e => updateClaim(key, e.target.value)} /></Grid>)}</Grid>
        </Paper>
        <Stack direction="row" justifyContent="flex-end" spacing={2}><Button variant="outlined" onClick={() => navigate('/clients')}>Cancel</Button><Button type="submit" variant="contained" disabled={loading}>{loading ? <CircularProgress size={22} /> : isEditMode ? 'Save configuration' : 'Register application'}</Button></Stack>
      </Grid>

      <Grid item xs={12} md={4}><Paper sx={{ p: 2.5, position: { md: 'sticky' }, top: { md: 90 } }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>Integration checklist</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Gunakan nilai ini saat mengonfigurasi aplikasi client.</Typography>
        <Stack spacing={1.5}>{[['1', 'Register application identity', Boolean(formData.name)], ['2', 'Add at least one redirect URI', uriCount > 0], ['3', 'Review security policy', configuration.pkceRequired], ['4', 'Save and copy credentials', false]].map(([number, label, done]) => <Box key={String(number)} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}><Chip label={number} size="small" color={done ? 'success' : 'default'} /> <Typography variant="body2" sx={{ flexGrow: 1 }}>{label}</Typography>{done && <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />}</Box>)}</Stack>
        <Divider sx={{ my: 2.5 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>SSO endpoints</Typography>
        <Typography variant="caption" color="text.secondary">Gunakan endpoint berikut di konfigurasi aplikasi client.</Typography>
        <Stack spacing={1.5} sx={{ mt: 2 }}>{[
          ['Authorization', 'GET', `${API_URL}/auth/authorize`, 'Memulai login dan menerima authorization code'],
          ['Token', 'POST', `${API_URL}/auth/token`, 'Menukar code menjadi access token / ID token'],
          ['UserInfo', 'GET', `${API_URL}/auth/userinfo`, 'Mengambil profil user dengan Bearer token'],
          ['Logout', 'POST', `${API_URL}/sessions/logout`, 'Mengakhiri sesi user dari aplikasi client']
        ].map(([name, method, url, description]) => <Box key={name} sx={{ p: 1.2, bgcolor: 'background.default', borderRadius: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}><Box sx={{ minWidth: 0 }}><Stack direction="row" spacing={0.8} alignItems="center"><Typography variant="body2" sx={{ fontWeight: 700 }}>{name}</Typography><Chip label={method} size="small" sx={{ height: 20, fontSize: 10 }} /></Stack><Typography variant="caption" color="text.secondary">{description}</Typography><Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', wordBreak: 'break-all', mt: 0.5 }}>{url}</Typography></Box><Button size="small" sx={{ minWidth: 32, px: 0.5 }} onClick={() => copy(String(url))}><ContentCopyIcon sx={{ fontSize: 16 }} /></Button></Stack>
        </Box>)}</Stack>
        <Alert severity="warning" sx={{ mt: 2 }}>Discovery (`/.well-known/openid-configuration`) dan JWKS belum tersedia di server ini. Untuk integrasi OIDC penuh, gunakan endpoint di atas atau tambahkan metadata server secara manual.</Alert>
        <Alert severity="info" sx={{ mt: 2 }}>Secret hanya ditampilkan satu kali setelah registrasi. Simpan di secret manager aplikasi.</Alert>
      </Paper></Grid>
    </Grid>
    <Dialog open={secretDialog.open} onClose={() => { setSecretDialog({ ...secretDialog, open: false }); navigate('/clients'); }} disableEscapeKeyDown><DialogTitle sx={{ color: 'error.main' }}>Client berhasil dibuat</DialogTitle><DialogContent><DialogContentText sx={{ mb: 2 }}>Salin credential ini sekarang. Client secret tidak akan ditampilkan lagi.</DialogContentText><Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}><Typography variant="caption">Client ID</Typography><Typography sx={{ fontFamily: 'monospace', mb: 2 }}>{secretDialog.clientId}</Typography><Typography variant="caption">Client Secret</Typography><Typography sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{secretDialog.secret}</Typography></Box></DialogContent><DialogActions><Button variant="contained" onClick={() => { setSecretDialog({ ...secretDialog, open: false }); navigate('/clients'); }}>I have copied the secret</Button></DialogActions></Dialog>
  </Box>;
};

const SectionTitle: React.FC<{ icon?: React.ReactNode; title: string; subtitle: string }> = ({ icon, title, subtitle }) => <Box sx={{ display: 'flex', gap: 1.2, mb: 2.5 }}>{icon && <Box sx={{ color: 'primary.main', pt: 0.2 }}>{icon}</Box>}<Box><Typography variant="h6" sx={{ fontSize: '1.05rem' }}>{title}</Typography><Typography variant="body2" color="text.secondary">{subtitle}</Typography></Box></Box>;

export default ClientForm;

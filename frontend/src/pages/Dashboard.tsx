import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, CircularProgress, Divider, Grid, LinearProgress,
  List, ListItem, ListItemIcon, ListItemText, Paper, Stack, Typography, Avatar
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon, CheckCircle as CheckCircleIcon, ErrorOutline as ErrorOutlineIcon,
  History as HistoryIcon, Apps as AppsIcon, Security as SecurityIcon,
  Settings as SettingsIcon, Warning as WarningIcon, CloudDone as CloudDoneIcon, ShowChart as ChartIcon
} from '@mui/icons-material';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { AppDispatch, RootState } from '../store/store';
import { fetchStats, fetchAuditLogs, fetchRecommendations } from '../store/providerSlice';

const API_URL = process.env.REACT_APP_API_BASE_URL || '/sso-api';
const API_ROOT = API_URL.replace(/\/api$/, '');

// Mock data for the chart to simulate 7-day activity
const mockActivityData = [
  { name: 'Mon', logins: 120, failed: 5 },
  { name: 'Tue', logins: 180, failed: 12 },
  { name: 'Wed', logins: 250, failed: 8 },
  { name: 'Thu', logins: 210, failed: 15 },
  { name: 'Fri', logins: 290, failed: 10 },
  { name: 'Sat', logins: 90, failed: 2 },
  { name: 'Sun', logins: 85, failed: 1 },
];

export const Dashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { stats, auditLogs, recommendations, loading } = useSelector((state: RootState) => state.providers);
  const [clientCount, setClientCount] = useState(0);
  const [systemHealthy, setSystemHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    dispatch(fetchStats());
    dispatch(fetchAuditLogs({ limit: 5 }));
    dispatch(fetchRecommendations());
    axios.get(`${API_URL}/clients`).then(({ data }) => setClientCount(Array.isArray(data) ? data.length : 0)).catch(() => undefined);
    axios.get(`${API_ROOT}/health/detailed`).then(({ data }) => setSystemHealthy(data.status === 'healthy')).catch(() => setSystemHealthy(false));
  }, [dispatch]);

  const setupProgress = useMemo(() => {
    const steps = [Boolean(stats?.providers.total), clientCount > 0, Boolean(stats?.providers.active)];
    return Math.round((steps.filter(Boolean).length / steps.length) * 100);
  }, [stats, clientCount]);
  
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  const cards = [
    { title: 'Identity Providers', value: stats?.providers.total ?? 0, icon: <SecurityIcon color="primary" />, helper: `${stats?.providers.active ?? 0} active`, path: '/providers' },
    { title: 'Client Applications', value: clientCount, icon: <AppsIcon color="secondary" />, helper: 'Apps connected to SSO', path: '/clients' },
    { title: 'Audit Activities', value: stats?.audit.total ?? 0, icon: <HistoryIcon color="action" />, helper: 'Tracked for compliance', path: '/audit' },
  ];

  if (loading && !stats) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><CircularProgress /></Box>;

  return <Box>
    <Paper sx={{ p: { xs: 2.5, md: 4 }, mb: 3, borderRadius: 3, color: 'white', background: 'linear-gradient(120deg, #1565c0 0%, #1976d2 55%, #42a5f5 100%)' }}>
      <Grid container spacing={3} alignItems="center">
        <Grid item xs={12} md={8}>
          <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: 1.5, fontWeight: 600 }}>Pepito IAM Control Center</Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, mt: 0.5 }}>{greeting}, Administrator.</Typography>
          <Typography sx={{ opacity: 0.9, maxWidth: 620, lineHeight: 1.6 }}>Kelola identity provider, aplikasi client, akses pengguna, dan tinjau peringatan keamanan SSO dari satu dasbor pusat.</Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button variant="contained" color="inherit" sx={{ color: 'primary.dark', fontWeight: 600, px: 3 }} onClick={() => navigate('/providers/new')}>Add Provider</Button>
            <Button variant="outlined" sx={{ color: 'white', borderColor: 'rgba(255,255,255,.6)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }} onClick={() => navigate('/clients/new')}>Register Client</Button>
          </Stack>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ bgcolor: 'rgba(255,255,255,.14)', p: 2.5, borderRadius: 3, backdropFilter: 'blur(10px)' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography fontWeight={600}>System Setup</Typography>
              <Typography fontWeight={700}>{setupProgress}%</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={setupProgress} sx={{ mt: 1.5, height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,.25)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }} />
            <Typography variant="caption" sx={{ mt: 1.5, opacity: 0.85, display: 'block' }}>Lengkapi konfigurasi provider dan client agar aplikasi siap menerima login.</Typography>
          </Box>
        </Grid>
      </Grid>
    </Paper>

    {recommendations && recommendations.length > 0 && (
      <Paper sx={{ p: 2.5, mb: 3, borderLeft: '5px solid', borderColor: 'error.main', bgcolor: '#fff5f5', borderRadius: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
          <Avatar sx={{ bgcolor: 'error.main', width: 32, height: 32 }}><WarningIcon fontSize="small" /></Avatar>
          <Typography variant="h6" color="error.dark" fontWeight={600}>Security Recommendations ({recommendations.length})</Typography>
        </Stack>
        <List sx={{ p: 0 }}>
          {recommendations.slice(0, 3).map(rec => (
            <ListItem key={rec.id} sx={{ px: 0, py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 40 }}><ErrorOutlineIcon color="error" fontSize="small" /></ListItemIcon>
              <ListItemText 
                primary={<Typography variant="body2" fontWeight={600} color="error.dark">{rec.title}</Typography>} 
                secondary={<Typography variant="caption" color="text.secondary">{rec.description}</Typography>} 
              />
              <Button size="small" variant="outlined" color="error" onClick={() => navigate(rec.actionPath)}>{rec.actionLabel}</Button>
            </ListItem>
          ))}
        </List>
      </Paper>
    )}

    <Grid container spacing={2.5} sx={{ mb: 3 }}>
      {cards.map(card => (
        <Grid item xs={12} sm={4} key={card.title}>
          <Card sx={{ height: '100%', cursor: 'pointer', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 } }} onClick={() => navigate(card.path)}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>{card.title}</Typography>
                  <Typography variant="h3" sx={{ fontWeight: 700, mt: 1 }}>{card.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{card.helper}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'action.hover', color: 'primary.main' }}>{card.icon}</Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>

    <Grid container spacing={3} sx={{ mb: 3 }}>
      <Grid item xs={12} md={8}>
        <Paper sx={{ p: 3, height: '100%', borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Box>
              <Typography variant="h6" fontWeight={600}>Authentication Traffic</Typography>
              <Typography variant="body2" color="text.secondary">Aktivitas login harian selama 7 hari terakhir.</Typography>
            </Box>
            <ChartIcon color="action" />
          </Stack>
          <Box sx={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <AreaChart data={mockActivityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLogins" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1976d2" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#1976d2" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d32f2f" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#d32f2f" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666' }} />
                <ChartTooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="logins" name="Successful Logins" stroke="#1976d2" strokeWidth={2} fillOpacity={1} fill="url(#colorLogins)" />
                <Area type="monotone" dataKey="failed" name="Failed Attempts" stroke="#d32f2f" strokeWidth={2} fillOpacity={1} fill="url(#colorFailed)" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Grid>
      
      <Grid item xs={12} md={4}>
        <Paper sx={{ p: 3, height: '100%', borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={600}>System Status</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Kesehatan layanan utama SSO.</Typography>
          
          <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 2, bgcolor: systemHealthy === false ? 'error.lighter' : 'success.lighter', borderRadius: 2 }}>
            <CloudDoneIcon color={systemHealthy ? 'success' : 'error'} fontSize="large" />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body1" fontWeight={600} color={systemHealthy === false ? 'error.main' : 'success.main'}>SSO API Core</Typography>
              <Typography variant="caption" color="text.secondary">
                {systemHealthy === null ? 'Checking service...' : systemHealthy ? 'Operational' : 'Degraded Performance'}
              </Typography>
            </Box>
          </Stack>
          
          <Divider sx={{ my: 2.5 }} />
          
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Quick Start</Typography>
          <Stack spacing={1.5}>
            {[
              { label: 'Connect Directory', path: '/providers/new', done: Boolean(stats?.providers.total) },
              { label: 'Register Application', path: '/clients/new', done: clientCount > 0 },
              { label: 'Create Custom Roles', path: '/roles', done: false }
            ].map(step => (
              <Box key={step.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderRadius: 1.5, '&:hover': { bgcolor: 'action.hover' } }}>
                {step.done ? <CheckCircleIcon color="success" fontSize="small" /> : <SettingsIcon color="action" fontSize="small" />}
                <Typography variant="body2" sx={{ flexGrow: 1, color: step.done ? 'text.secondary' : 'text.primary', textDecoration: step.done ? 'line-through' : 'none' }}>
                  {step.label}
                </Typography>
                <Button size="small" onClick={() => navigate(step.path)} sx={{ minWidth: 40 }}>Open</Button>
              </Box>
            ))}
          </Stack>
        </Paper>
      </Grid>
    </Grid>

    <Paper sx={{ p: 3, borderRadius: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={600}>Recent Security Events</Typography>
          <Typography variant="body2" color="text.secondary">Log aktivitas terbaru dari sistem.</Typography>
        </Box>
        <Button size="small" onClick={() => navigate('/audit')} endIcon={<ArrowForwardIcon />}>View all</Button>
      </Stack>
      
      {auditLogs.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>Belum ada aktivitas untuk ditampilkan.</Typography>
      ) : (
        <List sx={{ p: 0 }}>
          {auditLogs.map((log, index) => (
            <React.Fragment key={log.id}>
              <ListItem sx={{ px: 1, py: 1.5, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {log.result === 'success' ? <CheckCircleIcon color="success" /> : <ErrorOutlineIcon color="error" />}
                </ListItemIcon>
                <ListItemText 
                  primary={<Typography variant="body2" fontWeight={600}>{log.event_type.replace(/_/g, ' ')}</Typography>} 
                  secondary={<Typography variant="caption" color="text.secondary">{log.action} · {log.resource}</Typography>} 
                />
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" display="block" color="text.secondary">{new Date(log.timestamp).toLocaleDateString()}</Typography>
                  <Typography variant="caption" display="block" color="text.secondary">{new Date(log.timestamp).toLocaleTimeString()}</Typography>
                </Box>
              </ListItem>
              {index < auditLogs.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}
    </Paper>
  </Box>;
};

export default Dashboard;

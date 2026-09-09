import React, { useState } from 'react';
import { useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Box, Paper, Typography, TextField, Button, Alert, 
  CircularProgress, Checkbox, FormControlLabel, Divider, 
  InputAdornment, IconButton 
} from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_BASE_URL || '/sso-api';

export const Login: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const appName = searchParams.get('app_name') || 'Enterprise SSO';

  const [nip, setNip] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: any = { nip, password };
      if (clientId && redirectUri) {
        payload.client_id = clientId;
        payload.redirect_uri = redirectUri;
      }

      const res = await axios.post(`${API_URL}/auth/login`, payload);

      if (res.data.redirect_to) {
        // OAuth flow: Redirect back to client app with authorization code
        window.location.href = res.data.redirect_to;
      } else if (res.data.token) {
        // Normal Dashboard login
        localStorage.setItem('sso_token', res.data.token);
        if (res.data.user) {
          localStorage.setItem('sso_user', JSON.stringify(res.data.user));
        }
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials');
      setLoading(false);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundImage: `url(${process.env.PUBLIC_URL}/pepito-bg.png)`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      position: 'relative',
      px: 2,
      py: 4
    }}>
      <Paper sx={{ 
        p: { xs: 4, md: 5 }, 
        width: '100%', 
        maxWidth: 440, 
        borderRadius: 4, 
        position: 'relative', 
        zIndex: 1,
        bgcolor: '#ffffff', // Solid white base
        boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.2)',
        border: 'none',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* HEADER: Logo & SSO PORTAL */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box 
            component="img"
            src={`${process.env.PUBLIC_URL}/pepi-logo.png`}
            alt="Pepito Logo"
            sx={{ width: 200, height: 'auto', mb: 2 }}
            onError={(e: any) => {
              // Fallback if logo image is missing
              e.target.style.display = 'none';
              if (!e.target.dataset.fallbackApplied) {
                e.target.dataset.fallbackApplied = 'true';
                const div = document.createElement('div');
                div.innerHTML = '<span style="color:#2e7d32; font-weight:900; font-size:2.2rem; margin-bottom:16px; display:inline-block; font-family: cursive;">Pepito</span>';
                e.target.parentElement.insertBefore(div, e.target);
              }
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
            <Divider sx={{ width: '40px', borderColor: '#d7ccc8', borderWidth: 1 }} />
            <Typography sx={{ mx: 2, color: '#8d6e63', fontSize: '0.75rem', fontWeight: 800, letterSpacing: 1 }}>
              PEPITO IAM
            </Typography>
            <Divider sx={{ width: '40px', borderColor: '#d7ccc8', borderWidth: 1 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1b5e20', mb: 0.5 }}>
            Selamat Datang
          </Typography>
          <Typography variant="body2" sx={{ color: '#757575', fontWeight: 500 }}>
            {clientId ? `Sign in untuk mengakses ${appName}` : 'Sign in untuk mengakses Pepito IAM'}
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

        <form onSubmit={handleLogin}>
          {/* NIP INPUT */}
          <TextField
            fullWidth
            placeholder="NIP (Nomor Induk Pegawai)"
            type="text"
            value={nip}
            onChange={(e) => setNip(e.target.value)}
            margin="normal"
            required
            autoComplete="username"
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutlineIcon sx={{ color: '#9e9e9e' }} />
                </InputAdornment>
              ),
            }}
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': { 
                borderRadius: 2, 
                bgcolor: '#ffffff',
                '& fieldset': { borderColor: '#e0e0e0' },
                '&:hover fieldset': { borderColor: '#bdbdbd' },
                '&.Mui-focused fieldset': { borderColor: '#2e7d32' }
              } 
            }}
          />
          
          {/* PASSWORD INPUT */}
          <TextField
            fullWidth
            placeholder="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
            autoComplete="current-password"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlinedIcon sx={{ color: '#9e9e9e' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff sx={{ color: '#9e9e9e' }} /> : <Visibility sx={{ color: '#9e9e9e' }} />}
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{ 
              mb: 1,
              '& .MuiOutlinedInput-root': { 
                borderRadius: 2, 
                bgcolor: '#ffffff',
                '& fieldset': { borderColor: '#e0e0e0' },
                '&:hover fieldset': { borderColor: '#bdbdbd' },
                '&.Mui-focused fieldset': { borderColor: '#2e7d32' }
              } 
            }}
          />
          
          {/* CHECKBOX AND FORGOT PASSWORD */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, mt: 1 }}>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={rememberMe} 
                  onChange={(e) => setRememberMe(e.target.checked)} 
                  sx={{ 
                    color: '#e0e0e0',
                    '&.Mui-checked': { color: '#2e7d32' },
                    padding: '4px 9px'
                  }} 
                />
              }
              label={<Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#424242' }}>Ingat saya</Typography>}
            />
            <Link to="/forgot-password" style={{ 
              textDecoration: 'none', 
              color: '#2e7d32', 
              fontSize: '0.85rem',
              fontWeight: 600
            }}>
              Lupa password?
            </Link>
          </Box>
          
          {/* SUBMIT BUTTON */}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ 
              mb: 1, 
              borderRadius: 2, py: 1.5, 
              fontWeight: 700,
              fontSize: '1rem',
              bgcolor: '#2e7d32',
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#1b5e20', boxShadow: 'none' }
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Masuk'}
          </Button>
        </form>
      </Paper>
      
      {/* COPYRIGHT TEXT OUTSIDE CARD */}
      <Box sx={{ mt: 4, textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <Typography sx={{ color: 'white', fontSize: '0.8rem', mb: 0.5, textShadow: '0px 1px 3px rgba(0,0,0,0.8)' }}>
          © 2025 Pepito IAM. All rights reserved.
        </Typography>
        <Typography sx={{ color: '#ffb300', fontSize: '0.85rem', fontWeight: 600, textShadow: '0px 1px 3px rgba(0,0,0,0.8)' }}>
          One Account. One Access. All Pepito Systems.
        </Typography>
      </Box>
    </Box>
  );
};

export default Login;

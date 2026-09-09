import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Button, Alert, CircularProgress } from '@mui/material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_BASE_URL || '/sso-api';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: null, message: '' });
    setLoading(true);

    try {
      await axios.post(`${API_URL}/auth/forgot-password`, { email });
      setStatus({ 
        type: 'success', 
        message: 'If an account with that email exists, we have sent a password reset link to it. Please check your inbox (or backend logs).' 
      });
      setEmail('');
    } catch (err: any) {
      setStatus({ 
        type: 'error', 
        message: err.response?.data?.error || 'An error occurred while processing your request.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundImage: 'url(/pepito-bg.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      position: 'relative',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 0
      }
    }}>
      <Paper sx={{ 
        p: 5, 
        width: '100%', 
        maxWidth: 420, 
        borderRadius: 4, 
        position: 'relative', 
        zIndex: 1,
        bgcolor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255,255,255,0.4)'
      }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Box sx={{ 
              width: 56, height: 56, borderRadius: '50%', bgcolor: '#2e7d32', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(46, 125, 50, 0.4)'
            }}>
              <Typography variant="h5" sx={{ color: 'white', fontWeight: 900 }}>P</Typography>
            </Box>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1b5e20', mb: 1 }}>
            Forgot Password
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            Enter your email to receive a reset link
          </Typography>
        </Box>

        {status.type && (
          <Alert severity={status.type} sx={{ mb: 3, borderRadius: 2 }}>{status.message}</Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            required
            autoComplete="email"
            autoFocus
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.6)' } }}
          />
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ 
              mt: 4, mb: 3, 
              borderRadius: 2, py: 1.5, 
              fontWeight: 800,
              bgcolor: '#2e7d32',
              textTransform: 'uppercase',
              letterSpacing: 1,
              '&:hover': { bgcolor: '#1b5e20' }
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Send Reset Link'}
          </Button>
          
          <Box sx={{ textAlign: 'center' }}>
            <Link to="/login" style={{ 
              textDecoration: 'none', 
              color: '#2e7d32', 
              fontSize: '0.875rem',
              fontWeight: 600
            }}>
              Back to Login
            </Link>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};
export default ForgotPassword;

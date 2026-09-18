import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Container,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Security as SecurityIcon,
  History as HistoryIcon,
  People as PeopleIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Apps as AppsIcon,
  DevicesOther as DevicesOtherIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3003/api';
const drawerWidth = 240;

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem('sso_user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  }, []);

  const displayName = currentUser?.username || currentUser?.email || 'User';
  const avatarInitials = displayName.substring(0, 2).toUpperCase();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      // Clear the HttpOnly SSO session cookie on the server side
      await axios.post(`${API_URL}/auth/logout`, {}, { withCredentials: true });
    } catch {
      // Non-blocking: even if the call fails, clear local state
    }
    localStorage.removeItem('sso_token');
    localStorage.removeItem('sso_user');
    handleClose();
    navigate('/login');
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/', group: 'Overview' },
    { text: 'Identity Management', icon: <PeopleIcon />, path: '/users', group: 'Access & Applications' },
    { text: 'Groups & Departments', icon: <PeopleIcon />, path: '/groups', group: 'Access & Applications' },
    { text: 'Roles & Permissions', icon: <AdminPanelSettingsIcon />, path: '/roles', group: 'Access & Applications' },
    { text: 'Client Applications', icon: <AppsIcon />, path: '/clients', group: 'Access & Applications' },
    { text: 'Identity Providers', icon: <SecurityIcon />, path: '/providers', group: 'SSO Configuration' },
    { text: 'Active Sessions', icon: <DevicesOtherIcon />, path: '/sessions', group: 'Monitoring' },
    { text: 'Audit Logs', icon: <HistoryIcon />, path: '/audit', group: 'Monitoring' },
  ];

  const rolesToCheck = currentUser?.roles || (currentUser?.role ? [currentUser.role] : []);
  console.log('Current User Debug:', currentUser);
  console.log('Roles found:', rolesToCheck);

  const hasSettingsAccess = rolesToCheck.some((r: any) => {
    const roleName = typeof r === 'string' ? r.toLowerCase() : (r.name || '').toLowerCase();
    return roleName.includes('superadmin') || 
           roleName.includes('super admin') || 
           roleName.includes('appmanager') ||
           roleName.includes('app manager');
  });

  if (hasSettingsAccess) {
    menuItems.push({ text: 'Master Data', icon: <SettingsIcon />, path: '/settings/master-data', group: 'Settings' });
  }

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ px: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <Box component="img" src={`${process.env.PUBLIC_URL}/pepi-logo.png`} alt="Pepito IAM logo" sx={{ width: 42, height: 42, objectFit: 'contain', flexShrink: 0 }} onError={(event: React.SyntheticEvent<HTMLImageElement>) => { event.currentTarget.style.display = 'none'; }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap component="div" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1.1 }}>Pepito IAM</Typography>
            <Typography variant="caption" noWrap component="div" color="text.secondary" sx={{ lineHeight: 1.2 }}>Identity &amp; Access Management</Typography>
          </Box>
        </Box>
      </Toolbar>
      <Divider />
      <List sx={{ flexGrow: 1, px: 1 }}>
        {menuItems.map((item, index) => {
          const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <React.Fragment key={item.text}>
              {(index === 0 || item.group !== menuItems[index - 1]?.group) && <ListSubheader sx={{ bgcolor: 'transparent', px: 2, pt: index === 0 ? 0 : 2, pb: 0.75, color: 'text.disabled', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.group}</ListSubheader>}
              <ListItem disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => {
                    navigate(item.path);
                    setMobileOpen(false);
                  }}
                  sx={{
                    borderRadius: 2,
                    backgroundColor: active ? 'primary.light' : 'transparent',
                    color: active ? 'primary.contrastText' : 'text.primary',
                    '&:hover': {
                      backgroundColor: active ? 'primary.light' : 'action.hover',
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: active ? 'primary.contrastText' : 'text.secondary' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: active ? 600 : 500 }} />
                </ListItemButton>
              </ListItem>
            </React.Fragment>
          );
        })}
      </List>
      <Divider />
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Pepito IAM v1.0.0
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          boxShadow: 'none',
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          color: 'text.primary',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
            {menuItems.find(item => item.path !== '/' ? location.pathname.startsWith(item.path) : location.pathname === '/')?.text || 'Pepito IAM'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ display: { xs: 'none', md: 'block' }, fontWeight: 500 }}>
              {displayName}
            </Typography>
            <Tooltip title="Account settings">
              <IconButton onClick={handleMenu} size="small" sx={{ ml: 1 }}>
                <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>{avatarInitials}</Avatar>
              </IconButton>
            </Tooltip>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={handleClose}>Profile</MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        <Container maxWidth="lg" sx={{ py: 2 }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
};
export default Layout;

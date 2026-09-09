import React, { useEffect, useState } from 'react';
import { formatServerDate } from '../utils/date';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  MoreVert as MoreVertIcon,
  LockOpen as LockOpenIcon,
  VpnKey as VpnKeyIcon,
  Password as PasswordIcon,
  Phishing as PhishingIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchUsers, deleteUser, toggleUserStatus, resetUserMfa, unlockUserAccount, forceUserPasswordChange, revokeUserSessions } from '../store/userSlice';
import { useNavigate } from 'react-router-dom';

const UserList: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { users, total, loading } = useAppSelector((state) => state.users);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  // Menu state for user actions
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [activeMenuUser, setActiveMenuUser] = useState<any>(null);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, statusFilter]);

  const loadUsers = () => {
    dispatch(
      fetchUsers({
        limit: rowsPerPage,
        offset: page * rowsPerPage,
        search: searchTerm,
        status: statusFilter,
      })
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    loadUsers();
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDeleteClick = (id: string) => {
    setSelectedUserId(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedUserId) {
      await dispatch(deleteUser(selectedUserId));
      loadUsers();
    }
    setDeleteDialogOpen(false);
    setSelectedUserId(null);
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    await dispatch(toggleUserStatus({ id, status: newStatus }));
    loadUsers();
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>, user: any) => {
    setAnchorEl(event.currentTarget);
    setActiveMenuUser(user);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setActiveMenuUser(null);
  };

  const handleEnterpriseAction = async (action: 'mfa' | 'unlock' | 'password' | 'sessions') => {
    if (!activeMenuUser) return;
    
    switch (action) {
      case 'mfa':
        await dispatch(resetUserMfa(activeMenuUser.id));
        break;
      case 'unlock':
        await dispatch(unlockUserAccount(activeMenuUser.id));
        break;
      case 'password':
        await dispatch(forceUserPasswordChange(activeMenuUser.id));
        break;
      case 'sessions':
        await dispatch(revokeUserSessions(activeMenuUser.id));
        break;
    }
    handleMenuClose();
    loadUsers();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'disabled':
        return 'error';
      case 'suspended':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Identity Management
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => navigate('/users/new')}
        >
          Add User
        </Button>
      </Box>

      <Paper sx={{ mb: 3, p: 2 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1 }}
          />
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="disabled">Disabled</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
            </Select>
          </FormControl>

          <Button type="submit" variant="outlined">
            Search
          </Button>
        </form>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>NIP</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Cabang</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">Loading...</TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">No users found</TableCell>
              </TableRow>
            ) : (
              users.map((user: any) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body1" fontWeight={500}>
                        {user.first_name} {user.last_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {user.email || 'No email'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{user.nip}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.cabang || '-'}</TableCell>
                  <TableCell>
                    {typeof user.roles === 'string' && user.roles.trim() !== '' ? (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {user.roles.split(',').map((roleName: string) => (
                          <Chip key={roleName} label={roleName.trim()} size="small" variant="outlined" />
                        ))}
                      </Box>
                    ) : user.roles && Array.isArray(user.roles) && user.roles.length > 0 ? (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {user.roles.map((role: any) => (
                          <Chip key={role.id || role.name} label={role.name || role} size="small" variant="outlined" />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">No Role</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={user.status.toUpperCase()}
                        color={getStatusColor(user.status)}
                        size="small"
                      />
                      {user.locked_until && new Date(user.locked_until) > new Date() && (
                        <Chip label="LOCKED" color="error" size="small" icon={<LockIcon fontSize="small"/>} />
                      )}
                      {user.mfa_enabled && (
                        <Chip label="MFA" color="info" size="small" icon={<VpnKeyIcon fontSize="small"/>} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {formatServerDate(user.created_at, false)}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      color={user.status === 'active' ? 'error' : 'success'}
                      onClick={() => handleToggleStatus(user.id, user.status)}
                      title={user.status === 'active' ? 'Disable User' : 'Enable User'}
                    >
                      {user.status === 'active' ? <BlockIcon /> : <CheckCircleIcon />}
                    </IconButton>
                    <IconButton
                      color="primary"
                      onClick={() => navigate(`/users/edit/${user.id}`)}
                      title="Edit User"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      color="error"
                      onClick={() => handleDeleteClick(user.id)}
                      title="Delete User"
                    >
                      <DeleteIcon />
                    </IconButton>
                    <IconButton onClick={(e) => handleMenuClick(e, user)} title="More Actions">
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this user? This action cannot be undone.
            (Soft deletion will be applied in the database).
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enterprise Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleEnterpriseAction('mfa')} disabled={!activeMenuUser?.mfa_enabled}>
          <ListItemIcon><LockOpenIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Reset MFA</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleEnterpriseAction('unlock')} disabled={!activeMenuUser?.locked_until || new Date(activeMenuUser.locked_until) <= new Date()}>
          <ListItemIcon><LockIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Unlock Account</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleEnterpriseAction('password')}>
          <ListItemIcon><PasswordIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Force Password Change</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleEnterpriseAction('sessions')}>
          <ListItemIcon><PhishingIcon fontSize="small" color="warning" /></ListItemIcon>
          <ListItemText>Revoke All Sessions</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default UserList;

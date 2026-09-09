import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3003/api';

export interface UserEmail {
  id?: string;
  email: string;
  is_primary?: boolean;
}

export interface UserPhone {
  id?: string;
  phone_number: string;
  type: string;
  is_primary?: boolean;
}

export interface UserAddress {
  id?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary?: boolean;
}

export interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  status: 'active' | 'disabled' | 'suspended';
  nip: string;
  cabang?: string;
  regency?: string;
  loc_code?: string;
  location_name?: string;
  cost_center_name?: string;
  job_type?: string;
  position?: string;
  grade?: string;
  join_date?: string;
  emp_type?: string;
  start_work?: string;
  last_day?: string;
  remarks?: string;
  created_at?: string;
  last_login_at?: string;
  
  // Profile
  birth_date?: string;
  gender?: string;
  bio?: string;
  timezone?: string;
  locale?: string;
  
  // Related
  emails?: UserEmail[];
  phones?: UserPhone[];
  addresses?: UserAddress[];
  roles?: any[];
  allowed_applications?: string[];
  allow_dashboard_access?: boolean;
  password?: string;
  force_password_change?: boolean;
}

interface UserState {
  users: User[];
  currentUser: User | null;
  total: number;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  users: [],
  currentUser: null,
  total: 0,
  loading: false,
  error: null,
};

export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (params: { search?: string; status?: string; limit?: number; offset?: number } = {}) => {
    const response = await axios.get(`${API_URL}/users`, { params });
    return response.data;
  }
);

export const fetchUserById = createAsyncThunk(
  'users/fetchUserById',
  async (id: string) => {
    const response = await axios.get(`${API_URL}/users/${id}`);
    return response.data;
  }
);

export const createUser = createAsyncThunk(
  'users/createUser',
  async (userData: Partial<User>) => {
    const response = await axios.post(`${API_URL}/users`, userData);
    return response.data;
  }
);

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async ({ id, data }: { id: string; data: Partial<User> }) => {
    const response = await axios.put(`${API_URL}/users/${id}`, data);
    return response.data;
  }
);

export const toggleUserStatus = createAsyncThunk(
  'users/toggleUserStatus',
  async ({ id, status }: { id: string; status: string }) => {
    const response = await axios.post(`${API_URL}/users/${id}/status`, { status });
    return response.data;
  }
);

export const deleteUser = createAsyncThunk(
  'users/deleteUser',
  async (id: string) => {
    await axios.delete(`${API_URL}/users/${id}`);
    return id;
  }
);

export const resetUserMfa = createAsyncThunk(
  'users/resetMfa',
  async (id: string) => {
    const response = await axios.post(`${API_URL}/users/${id}/reset-mfa`);
    return response.data;
  }
);

export const unlockUserAccount = createAsyncThunk(
  'users/unlockAccount',
  async (id: string) => {
    const response = await axios.post(`${API_URL}/users/${id}/unlock`);
    return response.data;
  }
);

export const forceUserPasswordChange = createAsyncThunk(
  'users/forcePasswordChange',
  async (id: string) => {
    const response = await axios.post(`${API_URL}/users/${id}/force-password-change`);
    return response.data;
  }
);

export const revokeUserSessions = createAsyncThunk(
  'users/revokeSessions',
  async (id: string) => {
    const response = await axios.post(`${API_URL}/users/${id}/revoke-sessions`);
    return response.data;
  }
);

const userSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    clearCurrentUser: (state) => {
      state.currentUser = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Users
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload.data;
        state.total = action.payload.pagination.total;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch users';
      })
      // Fetch User by ID
      .addCase(fetchUserById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload;
      })
      .addCase(fetchUserById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch user';
      })
      // Create User
      .addCase(createUser.fulfilled, (state, action) => {
        state.users.unshift(action.payload);
        state.total += 1;
      })
      // Update User
      .addCase(updateUser.fulfilled, (state, action) => {
        const index = state.users.findIndex(u => u.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        if (state.currentUser?.id === action.payload.id) {
          state.currentUser = action.payload;
        }
      })
      // Toggle Status
      .addCase(toggleUserStatus.fulfilled, (state, action) => {
        if (action.payload) {
          const index = state.users.findIndex(u => u.id === action.payload.id);
          const user = state.users[index];
          if (user) {
            user.status = action.payload.status;
          }
        }
      })
      // Delete User
      .addCase(deleteUser.fulfilled, (state, action) => {
        if (action.payload) {
          state.users = state.users.filter(u => u.id !== action.payload);
          state.total -= 1;
        }
      });
  },
});

export const { clearCurrentUser } = userSlice.actions;
export default userSlice.reducer;

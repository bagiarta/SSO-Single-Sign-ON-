import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3003/api';

export interface Provider {
  id?: string;
  name: string;
  type: 'saml' | 'oauth' | 'ldap';
  status: 'enabled' | 'disabled' | 'error';
  configuration: any;
  metadata?: any;
  last_validated_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuditLog {
  id: string;
  event_type: string;
  user_id: string | null;
  ip_address: string;
  resource: string;
  action: string;
  result: string;
  details: any;
  timestamp: string;
  username?: string;
  email?: string;
  user_agent?: string;
  device_info?: string;
}

export interface Stats {
  providers: {
    total: number;
    active: number;
    byType: {
      saml: number;
      oauth: number;
      ldap: number;
    };
  };
  audit: {
    total: number;
    recentActivity: Array<{ date: string; count: number }>;
  };
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  providerId?: string;
  providerName?: string;
  actionLabel: string;
  actionPath: string;
}

interface ProviderState {
  providers: Provider[];
  currentProvider: Provider | null;
  auditLogs: AuditLog[];
  auditTotal: number;
  stats: Stats | null;
  recommendations: Recommendation[];
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
}

const initialState: ProviderState = {
  providers: [],
  currentProvider: null,
  auditLogs: [],
  auditTotal: 0,
  stats: null,
  recommendations: [],
  loading: false,
  actionLoading: false,
  error: null,
};

// Async Thunks
export const fetchProviders = createAsyncThunk(
  'providers/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get<Provider[]>(`${API_BASE}/providers`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch providers');
    }
  }
);

export const fetchProviderById = createAsyncThunk(
  'providers/fetchById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await axios.get<Provider>(`${API_BASE}/providers/${id}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch provider details');
    }
  }
);

export const createProvider = createAsyncThunk(
  'providers/create',
  async (provider: Provider, { rejectWithValue, dispatch }) => {
    try {
      const response = await axios.post<Provider>(`${API_BASE}/providers`, provider);
      dispatch(fetchStats());
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create provider');
    }
  }
);

export const updateProvider = createAsyncThunk(
  'providers/update',
  async ({ id, provider }: { id: string; provider: Provider }, { rejectWithValue, dispatch }) => {
    try {
      const response = await axios.put<Provider>(`${API_BASE}/providers/${id}`, provider);
      dispatch(fetchStats());
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update provider');
    }
  }
);

export const deleteProvider = createAsyncThunk(
  'providers/delete',
  async (id: string, { rejectWithValue, dispatch }) => {
    try {
      await axios.delete(`${API_BASE}/providers/${id}`);
      dispatch(fetchStats());
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to delete provider');
    }
  }
);

export const toggleProviderStatus = createAsyncThunk(
  'providers/toggleStatus',
  async ({ id, status }: { id: string; status: 'enabled' | 'disabled' }, { rejectWithValue, dispatch }) => {
    try {
      const response = await axios.post<Provider>(`${API_BASE}/providers/${id}/toggle`, { status });
      dispatch(fetchStats());
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to toggle status');
    }
  }
);

export const fetchAuditLogs = createAsyncThunk(
  'providers/fetchAuditLogs',
  async ({ limit = 20, offset = 0, eventType = '' }: { limit?: number; offset?: number; eventType?: string }, { rejectWithValue }) => {
    try {
      const response = await axios.get<{ logs: AuditLog[]; pagination: { total: number } }>(
        `${API_BASE}/audit`,
        { params: { limit, offset, eventType } }
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch audit logs');
    }
  }
);

export const fetchStats = createAsyncThunk(
  'providers/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get<Stats>(`${API_BASE}/audit/stats`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch stats');
    }
  }
);

export const fetchRecommendations = createAsyncThunk(
  'providers/fetchRecommendations',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get<Recommendation[]>(`${API_BASE}/providers/recommendations`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch recommendations');
    }
  }
);

export const testConnection = async (type: string, configuration: any, id?: string) => {
  try {
    const response = await axios.post<{ success: boolean; message: string; details?: any }>(
      `${API_BASE}/providers/test`,
      { type, configuration, id }
    );
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error || 'Failed to test connection configuration',
    };
  }
};

const providerSlice = createSlice({
  name: 'providers',
  initialState,
  reducers: {
    clearCurrentProvider: (state) => {
      state.currentProvider = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchProviders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProviders.fulfilled, (state, action: PayloadAction<Provider[]>) => {
        state.loading = false;
        state.providers = action.payload;
      })
      .addCase(fetchProviders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch by ID
      .addCase(fetchProviderById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProviderById.fulfilled, (state, action: PayloadAction<Provider>) => {
        state.loading = false;
        state.currentProvider = action.payload;
      })
      .addCase(fetchProviderById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create
      .addCase(createProvider.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(createProvider.fulfilled, (state, action: PayloadAction<Provider>) => {
        state.actionLoading = false;
        state.providers.unshift(action.payload);
      })
      .addCase(createProvider.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })
      // Update
      .addCase(updateProvider.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateProvider.fulfilled, (state, action: PayloadAction<Provider>) => {
        state.actionLoading = false;
        const index = state.providers.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.providers[index] = action.payload;
        }
        if (state.currentProvider?.id === action.payload.id) {
          state.currentProvider = action.payload;
        }
      })
      .addCase(updateProvider.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })
      // Delete
      .addCase(deleteProvider.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(deleteProvider.fulfilled, (state, action: PayloadAction<string>) => {
        state.actionLoading = false;
        state.providers = state.providers.filter(p => p.id !== action.payload);
        if (state.currentProvider?.id === action.payload) {
          state.currentProvider = null;
        }
      })
      .addCase(deleteProvider.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })
      // Toggle Status
      .addCase(toggleProviderStatus.fulfilled, (state, action: PayloadAction<Provider>) => {
        const index = state.providers.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          const prov = state.providers[index];
          if (prov) {
            prov.status = action.payload.status;
          }
        }
        if (state.currentProvider && state.currentProvider.id === action.payload.id) {
          state.currentProvider.status = action.payload.status;
        }
      })
      // Fetch Audit Logs
      .addCase(fetchAuditLogs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAuditLogs.fulfilled, (state, action: PayloadAction<{ logs: AuditLog[]; pagination: { total: number } }>) => {
        state.loading = false;
        state.auditLogs = action.payload.logs;
        state.auditTotal = action.payload.pagination.total;
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch Stats
      .addCase(fetchStats.fulfilled, (state, action: PayloadAction<Stats>) => {
        state.stats = action.payload;
      })
      // Fetch Recommendations
      .addCase(fetchRecommendations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRecommendations.fulfilled, (state, action: PayloadAction<Recommendation[]>) => {
        state.loading = false;
        state.recommendations = action.payload;
      })
      .addCase(fetchRecommendations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCurrentProvider, clearError } = providerSlice.actions;
export default providerSlice.reducer;

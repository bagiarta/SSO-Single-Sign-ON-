import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/sso-api';

interface MasterDataState {
  branches: any[];
  locations: any[];
  departments: any[];
  positions: any[];
  grades: any[];
  employeeTypes: any[];
  costCenters: any[];
  regions: any[];
  loading: boolean;
  error: string | null;
}

const initialState: MasterDataState = {
  branches: [],
  locations: [],
  departments: [],
  positions: [],
  grades: [],
  employeeTypes: [],
  costCenters: [],
  regions: [],
  loading: false,
  error: null,
};

export const fetchMasterData = createAsyncThunk('masterData/fetchAll', async () => {
  const [
    branchesRes,
    locationsRes,
    departmentsRes,
    positionsRes,
    gradesRes,
    employeeTypesRes,
    costCentersRes,
    regionsRes
  ] = await Promise.all([
    axios.get(`${API_BASE_URL}/master/branches`, { withCredentials: true }),
    axios.get(`${API_BASE_URL}/master/locations`, { withCredentials: true }),
    axios.get(`${API_BASE_URL}/master/departments`, { withCredentials: true }),
    axios.get(`${API_BASE_URL}/master/positions`, { withCredentials: true }),
    axios.get(`${API_BASE_URL}/master/grades`, { withCredentials: true }),
    axios.get(`${API_BASE_URL}/master/employee-types`, { withCredentials: true }),
    axios.get(`${API_BASE_URL}/master/cost-centers`, { withCredentials: true }),
    axios.get(`${API_BASE_URL}/master/regions`, { withCredentials: true }),
  ]);

  return {
    branches: branchesRes.data,
    locations: locationsRes.data,
    departments: departmentsRes.data,
    positions: positionsRes.data,
    grades: gradesRes.data,
    employeeTypes: employeeTypesRes.data,
    costCenters: costCentersRes.data,
    regions: regionsRes.data,
  };
});

export const createMasterData = createAsyncThunk(
  'masterData/create',
  async ({ type, data }: { type: string, data: any }) => {
    const res = await axios.post(`${API_BASE_URL}/master/${type}`, data, { withCredentials: true });
    return res.data;
  }
);

export const updateMasterData = createAsyncThunk(
  'masterData/update',
  async ({ type, id, data }: { type: string, id: string, data: any }) => {
    const res = await axios.put(`${API_BASE_URL}/master/${type}/${id}`, data, { withCredentials: true });
    return res.data;
  }
);

export const deleteMasterData = createAsyncThunk(
  'masterData/delete',
  async ({ type, id }: { type: string, id: string }) => {
    const res = await axios.delete(`${API_BASE_URL}/master/${type}/${id}`, { withCredentials: true });
    return res.data;
  }
);

const masterDataSlice = createSlice({
  name: 'masterData',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMasterData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMasterData.fulfilled, (state, action) => {
        state.loading = false;
        state.branches = action.payload.branches;
        state.locations = action.payload.locations;
        state.departments = action.payload.departments;
        state.positions = action.payload.positions;
        state.grades = action.payload.grades;
        state.employeeTypes = action.payload.employeeTypes;
        state.costCenters = action.payload.costCenters;
        state.regions = action.payload.regions;
      })
      .addCase(fetchMasterData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch master data';
      });
  },
});

export default masterDataSlice.reducer;

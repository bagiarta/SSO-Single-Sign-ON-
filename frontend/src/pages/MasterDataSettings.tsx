import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Tabs, Tab, Paper, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress, Select, MenuItem, InputLabel, FormControl, Alert 
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store/store';
import { fetchMasterData, createMasterData, updateMasterData, deleteMasterData } from '../store/masterDataSlice';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} id={`master-tabpanel-${index}`} aria-labelledby={`master-tab-${index}`} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const MASTER_CONFIGS = [
  { 
    id: 'branches', label: 'Branches', apiType: 'branches',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'branch_code', label: 'Branch Code', type: 'text', required: true },
      { key: 'region_id', label: 'Region', type: 'select', optionsKey: 'regions', required: false }
    ]
  },
  { 
    id: 'locations', label: 'Locations', apiType: 'locations',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'address', label: 'Address', type: 'text', required: false }
    ]
  },
  { 
    id: 'departments', label: 'Departments', apiType: 'departments',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true }
    ]
  },
  { 
    id: 'positions', label: 'Positions', apiType: 'positions',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'department_id', label: 'Department', type: 'select', optionsKey: 'departments', required: false }
    ]
  },
  { 
    id: 'grades', label: 'Grades', apiType: 'grades',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true }
    ]
  },
  { 
    id: 'employeeTypes', label: 'Employee Types', apiType: 'employee-types',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true }
    ]
  },
  { 
    id: 'costCenters', label: 'Cost Centers', apiType: 'cost-centers',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true }
    ]
  },
  { 
    id: 'regions', label: 'Regions', apiType: 'regions',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true }
    ]
  },
];

const MasterDataSettings: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const masterData = useSelector((state: RootState) => state.masterData);
  const [tabValue, setTabValue] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    dispatch(fetchMasterData());
  }, [dispatch]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleOpenDialog = (record?: any) => {
    setEditingRecord(record || null);
    setFormData(record ? { ...record } : {});
    setActionError('');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const currentConfig = MASTER_CONFIGS[tabValue];
  const currentData = currentConfig ? (masterData as any)[currentConfig.id] || [] : [];

  const handleSave = async () => {
    if (!currentConfig) return;
    setIsSubmitting(true);
    setActionError('');
    try {
      if (editingRecord) {
        await dispatch(updateMasterData({ type: currentConfig.apiType, id: editingRecord.id, data: formData })).unwrap();
      } else {
        await dispatch(createMasterData({ type: currentConfig.apiType, data: formData })).unwrap();
      }
      setDialogOpen(false);
      dispatch(fetchMasterData());
    } catch (err: any) {
      setActionError(err.message || 'Failed to save record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentConfig) return;
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await dispatch(deleteMasterData({ type: currentConfig.apiType, id })).unwrap();
        dispatch(fetchMasterData());
      } catch (err: any) {
        alert(err.message || 'Failed to delete record. It might be in use.');
      }
    }
  };

  const getSelectLabel = (optionsKey: string, id: string) => {
    const list = (masterData as any)[optionsKey] || [];
    const item = list.find((i: any) => i.id === id);
    return item ? item.name : '-';
  };

  if (masterData.loading && !currentData.length) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>Master Data Settings</Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          variant="scrollable" 
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {MASTER_CONFIGS.map((config) => (
            <Tab key={config.id} label={config.label} />
          ))}
        </Tabs>

        {MASTER_CONFIGS.map((config, index) => (
          <TabPanel key={config.id} value={tabValue} index={index}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                Add {config.label.slice(0, -1)}
              </Button>
            </Box>
            
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {config.fields.map(field => (
                      <TableCell key={field.key} sx={{ fontWeight: 'bold' }}>{field.label}</TableCell>
                    ))}
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={config.fields.length + 1} align="center" sx={{ py: 3 }}>
                        No records found.
                      </TableCell>
                    </TableRow>
                  ) : currentData.map((row: any) => (
                    <TableRow key={row.id}>
                      {config.fields.map(field => (
                        <TableCell key={field.key}>
                          {field.type === 'select' 
                            ? getSelectLabel(field.optionsKey!, row[field.key])
                            : row[field.key] || '-'}
                        </TableCell>
                      ))}
                      <TableCell align="right">
                        <IconButton size="small" color="primary" onClick={() => handleOpenDialog(row)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>
        ))}
      </Paper>

      {/* Dialog for Add/Edit */}
      {currentConfig && (
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>{editingRecord ? `Edit ${currentConfig.label.slice(0, -1)}` : `Add ${currentConfig.label.slice(0, -1)}`}</DialogTitle>
          <DialogContent dividers>
            {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              {currentConfig.fields.map(field => {
                if (field.type === 'select') {
                  const options = (masterData as any)[field.optionsKey!] || [];
                  return (
                    <FormControl key={field.key} fullWidth size="small">
                      <InputLabel>{field.label}</InputLabel>
                      <Select
                        label={field.label}
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      >
                        <MenuItem value=""><em>None</em></MenuItem>
                        {options.map((opt: any) => (
                          <MenuItem key={opt.id} value={opt.id}>{opt.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  );
                }

                return (
                  <TextField
                    key={field.key}
                    label={field.label}
                    fullWidth
                    size="small"
                    required={field.required}
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  />
                );
              })}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button variant="contained" onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default MasterDataSettings;

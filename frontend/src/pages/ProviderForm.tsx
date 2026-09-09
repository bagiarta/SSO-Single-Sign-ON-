import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Collapse,
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  PlayArrow as TestIcon,
} from '@mui/icons-material';
import { AppDispatch, RootState } from '../store/store';
import {
  createProvider,
  updateProvider,
  fetchProviderById,
  clearCurrentProvider,
  testConnection,
} from '../store/providerSlice';

export const ProviderForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const isEditMode = Boolean(id);
  const { currentProvider, loading, actionLoading, error } = useSelector((state: RootState) => state.providers);

  // Form States
  const [name, setName] = useState('');
  const [type, setType] = useState<'saml' | 'oauth' | 'ldap'>('saml');
  const [status, setStatus] = useState<'enabled' | 'disabled'>('enabled');
  
  // SAML configs
  const [samlEntityId, setSamlEntityId] = useState('');
  const [samlEntryPoint, setSamlEntryPoint] = useState('');
  const [samlLogoutUrl, setSamlLogoutUrl] = useState('');
  const [samlCert, setSamlCert] = useState('');

  // OAuth configs
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [oauthAuthUrl, setOauthAuthUrl] = useState('');
  const [oauthTokenUrl, setOauthTokenUrl] = useState('');
  const [oauthUserInfoUrl, setOauthUserInfoUrl] = useState('');
  const [oauthScope, setOauthScope] = useState('openid profile email');

  // LDAP configs
  const [ldapUrl, setLdapUrl] = useState('');
  const [ldapBindDN, setLdapBindDN] = useState('');
  const [ldapBindPassword, setLdapBindPassword] = useState('');
  const [ldapSearchBase, setLdapSearchBase] = useState('');
  const [ldapSearchFilter, setLdapSearchFilter] = useState('(sAMAccountName={{username}})');

  // Test connection states
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  useEffect(() => {
    if (isEditMode && id) {
      dispatch(fetchProviderById(id));
    } else {
      dispatch(clearCurrentProvider());
      resetForm();
    }
  }, [id, isEditMode, dispatch]);

  useEffect(() => {
    if (currentProvider && isEditMode) {
      setName(currentProvider.name);
      setType(currentProvider.type);
      setStatus(currentProvider.status === 'error' ? 'disabled' : (currentProvider.status as any));

      const config = currentProvider.configuration || {};
      if (currentProvider.type === 'saml') {
        setSamlEntityId(config.entityId || '');
        setSamlEntryPoint(config.entryPoint || '');
        setSamlLogoutUrl(config.logoutUrl || '');
        setSamlCert(config.cert || '');
      } else if (currentProvider.type === 'oauth') {
        setOauthClientId(config.clientID || '');
        setOauthClientSecret(config.clientSecret || '');
        setOauthAuthUrl(config.authorizationURL || '');
        setOauthTokenUrl(config.tokenURL || '');
        setOauthUserInfoUrl(config.userInfoURL || '');
        setOauthScope(config.scope || 'openid profile email');
      } else if (currentProvider.type === 'ldap') {
        setLdapUrl(config.url || '');
        setLdapBindDN(config.bindDN || '');
        setLdapBindPassword(config.bindCredentials || '');
        setLdapSearchBase(config.searchBase || '');
        setLdapSearchFilter(config.searchFilter || '(sAMAccountName={{username}})');
      }
    }
  }, [currentProvider, isEditMode]);

  const resetForm = () => {
    setName('');
    setType('saml');
    setStatus('enabled');
    setSamlEntityId('');
    setSamlEntryPoint('');
    setSamlLogoutUrl('');
    setSamlCert('');
    setOauthClientId('');
    setOauthClientSecret('');
    setOauthAuthUrl('');
    setOauthTokenUrl('');
    setOauthUserInfoUrl('');
    setOauthScope('openid profile email');
    setLdapUrl('');
    setLdapBindDN('');
    setLdapBindPassword('');
    setLdapSearchBase('');
    setLdapSearchFilter('(sAMAccountName={{username}})');
    setTestResult(null);
  };

  const buildConfiguration = () => {
    if (type === 'saml') {
      return {
        entityId: samlEntityId,
        entryPoint: samlEntryPoint,
        logoutUrl: samlLogoutUrl,
        cert: samlCert,
      };
    } else if (type === 'oauth') {
      return {
        clientID: oauthClientId,
        clientSecret: oauthClientSecret,
        authorizationURL: oauthAuthUrl,
        tokenURL: oauthTokenUrl,
        userInfoURL: oauthUserInfoUrl,
        scope: oauthScope,
      };
    } else {
      return {
        url: ldapUrl,
        bindDN: ldapBindDN,
        bindCredentials: ldapBindPassword,
        searchBase: ldapSearchBase,
        searchFilter: ldapSearchFilter,
      };
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    const configuration = buildConfiguration();
    const result = await testConnection(type, configuration, id);
    setTestResult(result);
    setTestingConnection(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const providerData = {
      name,
      type,
      status: status as any,
      configuration: buildConfiguration(),
    };

    let actionResult;
    if (isEditMode && id) {
      actionResult = await dispatch(updateProvider({ id, provider: providerData }));
    } else {
      actionResult = await dispatch(createProvider(providerData));
    }

    if (!actionResult.hasOwnProperty('error')) {
      navigate('/providers');
    }
  };

  if (loading && isEditMode) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/providers')}
        sx={{ mb: 3 }}
      >
        Back to Providers
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        {isEditMode ? 'Edit Identity Provider' : 'New Identity Provider'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Fill in the SSO connection details. Test your configuration before saving.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSave}>
        <Grid container spacing={3}>
          {/* General Metadata Panel */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>General Information</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Provider Name"
                    fullWidth
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth disabled={isEditMode}>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={type}
                      label="Type"
                      onChange={(e) => setType(e.target.value as any)}
                    >
                      <MenuItem value="saml">SAML 2.0</MenuItem>
                      <MenuItem value="oauth">OAuth 2.0 / OIDC</MenuItem>
                      <MenuItem value="ldap">LDAP Directory</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={status}
                      label="Status"
                      onChange={(e) => setStatus(e.target.value as any)}
                    >
                      <MenuItem value="enabled">Enabled</MenuItem>
                      <MenuItem value="disabled">Disabled</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Dynamic Configuration Panel */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {type === 'saml' && 'SAML 2.0 Settings'}
                {type === 'oauth' && 'OAuth 2.0 / OIDC Settings'}
                {type === 'ldap' && 'LDAP Server Settings'}
              </Typography>

              {type === 'saml' && (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      label="SAML Entity ID"
                      fullWidth
                      required
                      value={samlEntityId}
                      onChange={(e) => setSamlEntityId(e.target.value)}
                      placeholder="urn:example:sp"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="SAML Single Sign-On (SSO) URL"
                      fullWidth
                      required
                      value={samlEntryPoint}
                      onChange={(e) => setSamlEntryPoint(e.target.value)}
                      placeholder="https://idp.example.com/simplesaml/saml2/idp/SSOService.php"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="SAML Single Logout (SLO) URL"
                      fullWidth
                      value={samlLogoutUrl}
                      onChange={(e) => setSamlLogoutUrl(e.target.value)}
                      placeholder="https://idp.example.com/simplesaml/saml2/idp/SingleLogoutService.php"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Public Certificate (X.509 Certificate)"
                      fullWidth
                      multiline
                      rows={4}
                      value={samlCert}
                      onChange={(e) => setSamlCert(e.target.value)}
                      placeholder="-----BEGIN CERTIFICATE-----\nMIIDXTCCAkSgAwIBAgIJAJ...\n-----END CERTIFICATE-----"
                    />
                  </Grid>
                </Grid>
              )}

              {type === 'oauth' && (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Client ID"
                      fullWidth
                      required
                      value={oauthClientId}
                      onChange={(e) => setOauthClientId(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Client Secret"
                      fullWidth
                      required
                      value={oauthClientSecret}
                      type="password"
                      onChange={(e) => setOauthClientSecret(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Authorization Endpoint"
                      fullWidth
                      required
                      value={oauthAuthUrl}
                      onChange={(e) => setOauthAuthUrl(e.target.value)}
                      placeholder="https://auth.provider.com/oauth2/authorize"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Token Endpoint"
                      fullWidth
                      required
                      value={oauthTokenUrl}
                      onChange={(e) => setOauthTokenUrl(e.target.value)}
                      placeholder="https://auth.provider.com/oauth2/token"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="UserInfo Endpoint"
                      fullWidth
                      value={oauthUserInfoUrl}
                      onChange={(e) => setOauthUserInfoUrl(e.target.value)}
                      placeholder="https://auth.provider.com/oauth2/userinfo"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Scopes (Space separated)"
                      fullWidth
                      required
                      value={oauthScope}
                      onChange={(e) => setOauthScope(e.target.value)}
                    />
                  </Grid>
                </Grid>
              )}

              {type === 'ldap' && (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="LDAP Server URL"
                      fullWidth
                      required
                      value={ldapUrl}
                      onChange={(e) => setLdapUrl(e.target.value)}
                      placeholder="ldaps://ldap.company.com:636"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Search Base DN"
                      fullWidth
                      required
                      value={ldapSearchBase}
                      onChange={(e) => setLdapSearchBase(e.target.value)}
                      placeholder="ou=users,dc=company,dc=com"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Bind User DN"
                      fullWidth
                      required
                      value={ldapBindDN}
                      onChange={(e) => setLdapBindDN(e.target.value)}
                      placeholder="cn=read-only-admin,dc=company,dc=com"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Bind Password"
                      fullWidth
                      required
                      value={ldapBindPassword}
                      type="password"
                      onChange={(e) => setLdapBindPassword(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="User Search Filter"
                      fullWidth
                      required
                      value={ldapSearchFilter}
                      onChange={(e) => setLdapSearchFilter(e.target.value)}
                      placeholder="(sAMAccountName={{username}})"
                    />
                  </Grid>
                </Grid>
              )}
            </Paper>
          </Grid>

          {/* Test & Action Buttons Panel */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3, borderRadius: 3, border: '1px dashed', borderColor: 'primary.main', bgcolor: 'primary.50' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>Test Settings</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Validate config reachability before saving it.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={testingConnection ? <CircularProgress size={16} /> : <TestIcon />}
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                >
                  Test Connection
                </Button>
              </Box>

              <Collapse in={Boolean(testResult)}>
                {testResult && (
                  <Alert
                    severity={testResult.success ? 'success' : 'error'}
                    sx={{ mt: 2 }}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      {testResult.success ? 'Connection Test Succeeded!' : 'Connection Test Failed!'}
                    </Typography>
                    <Typography variant="caption">{testResult.message}</Typography>
                  </Alert>
                )}
              </Collapse>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 4 }}>
              <Button onClick={() => navigate('/providers')}>Cancel</Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={actionLoading ? <CircularProgress size={16} /> : <SaveIcon />}
                disabled={actionLoading}
              >
                Save Provider
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};
export default ProviderForm;

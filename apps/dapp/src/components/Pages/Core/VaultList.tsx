import { Navigate } from 'react-router-dom';

const VaultListPage = () => (
  <Navigate replace to={`/core/vaults/abc/summary`} />
);

export default VaultListPage;

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Sin `globals`, Testing Library no limpia el DOM solo entre tests.
afterEach(cleanup);

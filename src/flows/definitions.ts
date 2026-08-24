import type { FlowDefinition } from './executor.js'

export const DEFAULT_FLOWS: FlowDefinition[] = [
  {
    name: 'docker-setup',
    description: 'Set up a Docker Compose environment with a web application',
    steps: [
      {
        id: '1',
        description: 'Create Dockerfile for the application',
        files: ['Dockerfile'],
        reasoning: 'Define how the application should be containerized'
      },
      {
        id: '2',
        description: 'Create docker-compose.yml with services',
        files: ['docker-compose.yml'],
        reasoning: 'Define the services and their configuration'
      },
      {
        id: '3',
        description: 'Create .dockerignore file',
        files: ['.dockerignore'],
        reasoning: 'Exclude unnecessary files from the Docker build context'
      },
      {
        id: '4',
        description: 'Create .env.example file',
        files: ['.env.example'],
        reasoning: 'Document required environment variables'
      },
      {
        id: '5',
        description: 'Create README with Docker setup instructions',
        files: ['README.md'],
        reasoning: 'Provide clear instructions for users'
      },
    ],
  },
  {
    name: 'rest-api-setup',
    description: 'Create a REST API with authentication',
    steps: [
      {
        id: '1',
        description: 'Initialize Node.js project with package.json',
        files: ['package.json'],
        reasoning: 'Set up the project structure'
      },
      {
        id: '2',
        description: 'Create dependency directory (npm install is not permitted by the executor allowlist; install manually)',
        command: 'mkdir node_modules',
        reasoning: 'Dependency installation must be run manually — npm was removed from the allowlist (issues #886/#889/#890)'
      },
      {
        id: '3',
        description: 'Create server.js with Express setup',
        files: ['server.js'],
        reasoning: 'Set up the HTTP server'
      },
      {
        id: '4',
        description: 'Create routes directory and user routes',
        files: ['routes/userRoutes.js'],
        reasoning: 'Define API endpoints'
      },
      {
        id: '5',
        description: 'Create middleware for authentication',
        files: ['middleware/auth.js'],
        reasoning: 'Add security to protected routes'
      },
      {
        id: '6',
        description: 'Create .env.example file',
        files: ['.env.example'],
        reasoning: 'Document required environment variables'
      },
      {
        id: '7',
        description: 'Create README with API documentation',
        files: ['README.md'],
        reasoning: 'Provide clear usage instructions'
      },
    ],
  },
  {
    name: 'react-app-setup',
    description: 'Set up a modern React application with TypeScript',
    steps: [
      {
        id: '1',
        description: 'Create package.json with React dependencies',
        files: ['package.json'],
        reasoning: 'Define project dependencies'
      },
      {
        id: '2',
        description: 'Create tsconfig.json',
        files: ['tsconfig.json'],
        reasoning: 'Configure TypeScript'
      },
      {
        id: '3',
        description: 'Create vite.config.ts',
        files: ['vite.config.ts'],
        reasoning: 'Configure Vite build tool'
      },
      {
        id: '4',
        description: 'Create index.html entry point',
        files: ['index.html'],
        reasoning: 'Define the HTML structure'
      },
      {
        id: '5',
        description: 'Create src/main.tsx',
        files: ['src/main.tsx'],
        reasoning: 'Set up the React entry point'
      },
      {
        id: '6',
        description: 'Create src/App.tsx',
        files: ['src/App.tsx'],
        reasoning: 'Create the main application component'
      },
      {
        id: '7',
        description: 'Create .gitignore',
        files: ['.gitignore'],
        reasoning: 'Exclude build artifacts and node_modules'
      },
      {
        id: '8',
        description: 'Create README with setup instructions',
        files: ['README.md'],
        reasoning: 'Provide clear setup instructions'
      },
    ],
  },
  {
    name: 'testing-setup',
    description: 'Set up a comprehensive testing suite',
    steps: [
      {
        id: '1',
        description: 'Create test dependency directory (npm install is not permitted by the executor allowlist; install manually)',
        command: 'mkdir node_modules',
        reasoning: 'Test dependencies must be installed manually — npm was removed from the allowlist (issues #886/#889/#890)'
      },
      {
        id: '2',
        description: 'Create vitest.config.ts',
        files: ['vitest.config.ts'],
        reasoning: 'Configure Vitest'
      },
      {
        id: '3',
        description: 'Create test setup file',
        files: ['src/setupTests.ts'],
        reasoning: 'Set up testing environment'
      },
      {
        id: '4',
        description: 'Create example test file',
        files: ['src/__tests__/example.test.ts'],
        reasoning: 'Provide a template for writing tests'
      },
      {
        id: '5',
        description: 'Update package.json scripts',
        files: ['package.json'],
        reasoning: 'Add test scripts'
      },
      {
        id: '6',
        description: 'Create README with testing guide',
        files: ['README.md'],
        reasoning: 'Document testing practices'
      },
    ],
  },
]

export function getFlowByName(name: string): FlowDefinition | undefined {
  return DEFAULT_FLOWS.find(flow => flow.name === name)
}

export function getAllFlows(): FlowDefinition[] {
  return DEFAULT_FLOWS
}

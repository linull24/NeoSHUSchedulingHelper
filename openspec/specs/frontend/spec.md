# frontend Specification

## Purpose
TBD - created by archiving change 2025-add-enrollment-functions. Update Purpose after archive.
## Requirements
### Requirement: Frontend provides enrollment UI controls
Frontend MUST provide UI controls for users to enroll in and drop courses directly from the application interface.

#### Scenario: Enrolling in a course
- **WHEN** a user clicks the "Enroll" button on a course card
- **THEN** the application initiates the enrollment process, communicates with the backend, and updates the UI to reflect the new enrollment status

#### Scenario: Dropping a course
- **WHEN** a user clicks the "Drop" button on an enrolled course card
- **THEN** the application initiates the drop process, communicates with the backend, and updates the UI to reflect the course removal

### Requirement: Frontend handles authentication for enrollment operations
Frontend MUST manage user authentication for enrollment operations, including login prompts and token management.

#### Scenario: Authentication required for enrollment
- **WHEN** a user attempts to enroll in a course without valid authentication
- **THEN** the application prompts for login credentials and authenticates the user before proceeding with the enrollment

### Requirement: Frontend displays enrollment status and errors
Frontend MUST clearly display the enrollment status of courses and provide informative error messages when enrollment operations fail.

#### Scenario: Successful enrollment
- **WHEN** a course enrollment operation succeeds
- **THEN** the application updates the course card to show enrolled status and provides positive feedback to the user

#### Scenario: Failed enrollment
- **WHEN** a course enrollment operation fails
- **THEN** the application displays a user-friendly error message explaining the reason for failure

### Requirement: Frontend maintains synchronization with backend state
Frontend MUST maintain synchronization between local course state and the university system's course state.

#### Scenario: State synchronization
- **WHEN** the application starts or when triggered by the user
- **THEN** the frontend checks the current enrollment status in the university system and updates the local state to match

### Requirement: Frontend implements SSO login flow
Frontend MUST implement the SSO login flow, redirecting users to the appropriate login page and handling the redirect back to the application.

#### Scenario: User authentication via SSO
- **WHEN** a user needs to authenticate for enrollment operations
- **THEN** the frontend redirects them to `https://jwxt.shu.edu.cn/jwglxt/xtgl/login_slogin.html` and handles the SSO flow

### Requirement: Frontend manages session tokens
Frontend MUST securely store and manage session tokens obtained through the authentication process.

#### Scenario: Token management
- **WHEN** a user successfully authenticates
- **THEN** the frontend securely stores the session tokens and manages their lifecycle, including refreshing when necessary


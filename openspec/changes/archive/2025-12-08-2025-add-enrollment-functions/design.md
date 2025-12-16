# Design: Enrollment Functions for Course Selection and Dropping

## Context

The current application allows users to manage course selections locally but does not connect to the university's academic system for actual enrollment operations. Based on our research, we identified the following key aspects:

1. The university uses OAuth 2.0 for authentication
2. Course enrollment operations are performed through AJAX API calls
3. There are specific endpoints for enrolling in and dropping courses
4. Error handling is needed for various enrollment restrictions

## Decisions

### Authentication Management
- **Approach**: Use existing OAuth 2.0 authentication flow from the crawler
- **Token Storage**: Store authentication tokens securely in browser storage with expiration handling
- **Session Management**: Implement automatic token refresh when needed
- **Login Flow**: Must follow SSO redirect flow, accessing `https://jwxt.shu.edu.cn/jwglxt/xtgl/login_slogin.html` which will redirect to SSO login page

### API Integration
- **Endpoints**: Integrate with the university's course enrollment APIs:
  - Enroll: `/jwglxt/xsxk/zzxkyzbjk_xkBcZyZzxkYzb.html`
  - Drop: `/jwglxt/xsxk/zzxkyzbjk_tuikb.html`
- **Request Format**: Use form data with required parameters (course ID, class ID, etc.)
- **Response Handling**: Parse JSON responses to determine success/failure

### UI Components
- **Enroll Button**: Add "Enroll" button to course cards in the course listings
- **Drop Button**: Add "Drop" button to course cards in the selected courses panel
- **Status Indicators**: Show enrollment status and loading states
- **Error Messages**: Display user-friendly error messages for failed operations

### State Synchronization
- **Local State**: Keep local course selections in sync with system state
- **Bidirectional Sync**: Update local state when enrollment operations succeed
- **Conflict Resolution**: Handle discrepancies between local and system states

### Error Handling
- **Network Errors**: Handle connection timeouts and server errors gracefully
- **Business Logic Errors**: Parse and display meaningful messages for enrollment restrictions
- **Authentication Errors**: Redirect to login when tokens expire

## Technical Details

### Backend Integration
1. Create TypeScript services for enrollment operations:
   - `enrollInCourse(courseId: string, classId: string): Promise<boolean>`
   - `dropCourse(courseId: string, classId: string): Promise<boolean>`
   
2. Implement authentication service:
   - `authenticate(username: string, password: string): Promise<boolean>`
   - `isAuthenticated(): boolean`
   - `refreshToken(): Promise<boolean>`

### Frontend Integration
1. Add enrollment buttons to course cards:
   - Conditionally show "Enroll" or "Drop" based on current state
   - Disable buttons during operations
   - Show loading indicators

2. Update course card display:
   - Add enrollment status badges
   - Highlight enrolled courses differently

3. Implement error notifications:
   - Toast notifications for operation results
   - Modal dialogs for detailed error information

### Data Flow
1. User clicks "Enroll" button on a course card
2. Application checks authentication status
3. If authenticated, send enrollment request to university API
4. If not authenticated, prompt for login credentials
5. Process API response:
   - On success: Update local state and UI
   - On failure: Display error message
6. Update UI to reflect new enrollment status

## Security Considerations

1. **Credential Handling**: Never store passwords; only store OAuth tokens with secure flags
2. **Token Expiration**: Properly handle token expiration and refresh flows
3. **HTTPS**: Ensure all communications happen over secure connections
4. **CORS**: Handle cross-origin restrictions appropriately

## Performance Considerations

1. **Rate Limiting**: Implement client-side rate limiting to avoid overwhelming the university servers
2. **Caching**: Cache authentication status to minimize redundant checks
3. **Loading States**: Provide immediate feedback during API operations
4. **Error Recovery**: Implement retry logic for transient network issues

## Login Process Analysis

Based on analysis of the existing crawler code, the login process works as follows:

1. Access the main login page at `https://jwxt.shu.edu.cn/jwglxt/xtgl/login_slogin.html`
2. Get redirected to the SSO login page at `https://newsso.shu.edu.cn/login`
3. Submit credentials using RSA encryption (public key provided in the crawler)
4. Follow redirects back to the main system
5. Obtain necessary session cookies for API calls

## API Endpoints

Based on the crawler code analysis and examination of reference materials, the following API endpoints are relevant for enrollment operations:

1. **Course Selection Page**: 
   - URL: `https://jwxt.shu.edu.cn/jwglxt/xsxk/zzxkyzb_cxZzxkYzbIndex.html`
   - Used to access the main course selection interface
   
2. **Enrollment API**:
   - URL: `https://jwxt.shu.edu.cn/jwglxt/xsxk/zzxkyzbjk_xkBcZyZzxkYzb.html`
   - Method: POST
   - Parameters: jxb_ids, kch_id, xkxnm, xkxqm, etc.
   
3. **Drop Course API**:
   - URL: `https://jwxt.shu.edu.cn/jwglxt/xsxk/zzxkyzbjk_tuikb.html`
   - Method: POST
   - Parameters: jxb_ids, kch_id, xkxnm, xkxqm, etc.

4. **Selected Courses API** (for syncing):
   - URL: Pattern includes `zzxkyzb_cxZzxkYzbChoosedDisplay`
   - Used to retrieve the list of currently selected courses

## Required Form Parameters

To successfully make enrollment API calls, the following parameters are typically required:
- `jxb_ids`: Class ID(s) 
- `kch_id`: Course ID
- `xkxnm`: Academic year (e.g., 2024)
- `xkxqm`: Term (e.g., 12 for fall semester)
- Various other hidden form fields that need to be extracted from the course selection page

## API Response Format

Based on the user script analysis, API responses are typically JSON objects that may contain:
- `flag`: Indicates success (1) or failure (0)
- `msg`: Error message when operation fails
- Other data fields depending on the specific API

## Implementation Approach

The implementation should follow these steps:

1. **Authentication Layer**:
   - Implement SSO login flow
   - Manage session tokens
   - Handle token refresh

2. **API Client**:
   - Create service functions for enrollment operations
   - Handle request/response processing
   - Implement error handling

3. **UI Integration**:
   - Add enrollment controls to course cards
   - Implement status indicators
   - Add error messaging

4. **State Management**:
   - Sync local state with university system
   - Handle conflicts between local and remote states
   - Implement optimistic updates with rollback capability
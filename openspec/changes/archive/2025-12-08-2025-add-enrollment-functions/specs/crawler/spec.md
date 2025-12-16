## ADDED Requirements

### Requirement: Crawler extracts enrollment API parameters
Crawler MUST extract and store the necessary parameters for enrollment API calls, including endpoint URLs and required form fields.

#### Scenario: Extracting enrollment parameters
- **WHEN** crawling course data from the academic system
- **THEN** the crawler identifies and stores enrollment-related API endpoints and required parameters for future use in enrollment operations

### Requirement: Crawler preserves course identification data
Crawler outputs MUST include all necessary identifiers for enrollment operations, such as course IDs, class IDs, and other system-specific identifiers required for API calls.

#### Scenario: Storing course identifiers
- **WHEN** processing course data from the academic system
- **THEN** the crawler preserves all identifiers needed for enrollment operations, ensuring they are available in the course data files

### Requirement: Crawler captures enrollment restrictions
Crawler MUST identify and store enrollment restrictions and conditions for each course, such as capacity limits, prerequisite requirements, and drop restrictions.

#### Scenario: Recording enrollment restrictions
- **WHEN** crawling course details
- **THEN** the crawler captures restriction information and stores it with the course data to inform enrollment operations

### Requirement: Crawler extracts form parameters for enrollment
Crawler MUST extract all necessary hidden form parameters from the course selection page that are required for enrollment API calls.

#### Scenario: Extracting form parameters
- **WHEN** accessing the course selection page
- **THEN** the crawler parses and saves all hidden input fields and JavaScript variables that are needed for subsequent API calls

### Requirement: Crawler identifies academic year and term codes
Crawler MUST identify and store the academic year and term codes that are required for enrollment operations.

#### Scenario: Identifying academic period codes
- **WHEN** loading the course selection page
- **THEN** the crawler extracts the xkxnm (academic year) and xkxqm (term) values needed for enrollment API calls

### Requirement: Crawler identifies specific enrollment API endpoints
Crawler MUST identify and store the specific URLs for enrollment operations.

#### Scenario: Identifying enrollment endpoints
- **WHEN** crawling the course selection system
- **THEN** the crawler identifies and stores these specific API endpoints:
  - Course selection page: `/jwglxt/xsxk/zzxkyzb_cxZzxkYzbIndex.html`
  - Course list endpoint: `/jwglxt/xsxk/zzxkyzb_cxZzxkYzbPartDisplay.html`
  - Course detail endpoint: `/jwglxt/xsxk/zzxkyzbjk_cxJxbWithKchZzxkYzb.html`
  - Enrollment endpoint: `/jwglxt/xsxk/zzxkyzbjk_xkBcZyZzxkYzb.html`
  - Drop course endpoint: `/jwglxt/xsxk/zzxkyzbjk_tuikb.html`
  - Selected courses endpoint: `/jwglxt/xsxk/zzxkyzb_cxZzxkYzbChoosedDisplay.html`
  - Course ranking endpoint: `/xkgl/common_cxJxbrsmxIndex.html`

### Requirement: Crawler identifies required form fields for enrollment
Crawler MUST identify and store all required form fields for enrollment operations, including both visible and hidden fields.

#### Scenario: Identifying form fields
- **WHEN** accessing the course selection page
- **THEN** the crawler extracts and stores all form field names and their values needed for enrollment API calls:
  - xkxnm (academic year)
  - xkxqm (term)
  - kklxdm (course type code)
  - kch (course code)
  - kcmc (course name)
  - jxb_ids (class IDs)
  - Additional hidden fields as required by the system

### Requirement: Crawler identifies session-dependent parameters
Crawler MUST identify and store session-dependent parameters that are required for enrollment operations.

#### Scenario: Identifying session parameters
- **WHEN** establishing a session with the academic system
- **THEN** the crawler extracts and stores session-specific parameters needed for enrollment API calls

### Requirement: Crawler identifies enrollment JavaScript functions
Crawler MUST identify and document the core JavaScript functions used for enrollment operations in the academic system.

#### Scenario: Identifying enrollment functions
- **WHEN** analyzing the course selection page
- **THEN** the crawler identifies and documents these key JavaScript functions:
  - `chooseCourseZzxk(jxb_id, do_jxb_id, kch_id, jxbzls)` - Main function for enrolling in courses
  - `tuikeCourseZzxk()` - Main function for dropping courses
  - `loadCoursesByPaged()` - Function for loading course listings with pagination

### Requirement: Crawler identifies detailed enrollment function parameters
Crawler MUST identify and document the detailed parameters and behavior of enrollment functions.

#### Scenario: Documenting chooseCourseZzxk function
- **WHEN** analyzing the course selection page JavaScript
- **THEN** the crawler identifies that the `chooseCourseZzxk` function:
  - Takes four parameters: jxb_id, do_jxb_id, kch_id, jxbzls
  - Sends a POST request to `/jwglxt/xsxk/zzxkyzbjk_xkBcZyZzxkYzb.html`
  - Is triggered by clicking the "选课" (Enroll) button on course cards

#### Scenario: Documenting tuikeCourseZzxk function
- **WHEN** analyzing the course selection page JavaScript
- **THEN** the crawler identifies that the `tuikeCourseZzxk` function:
  - Is the main function for dropping courses
  - Sends a POST request to `/jwglxt/xsxk/zzxkyzbjk_tuikb.html`
  - Is triggered by clicking the "退课" (Drop) button on course cards

#### Scenario: Documenting chooseCoursesQuickly function
- **WHEN** analyzing the course selection page JavaScript
- **THEN** the crawler identifies that the `chooseCoursesQuickly` function:
  - Performs quick enrollment operations
  - Sends a POST request to `/jwglxt/xsxk/zzxkyzb_xkZzxkyzbQuickly.html`
  - Reloads the selected courses list after successful enrollment

### Requirement: Crawler identifies ranking information API
Crawler MUST identify and document the API endpoint used for retrieving course ranking information.

#### Scenario: Documenting ranking information API
- **WHEN** analyzing reference user scripts
- **THEN** the crawler identifies that the ranking information API:
  - Is located at `/xkgl/common_cxJxbrsmxIndex.html`
  - Requires a POST request with parameters: kch_id, jxb_id, xnm, xqm
  - Returns detailed ranking information for a specific course class

### Requirement: Crawler identifies login process and authentication APIs
Crawler MUST identify and document the login process and authentication APIs used by the academic system.

#### Scenario: Documenting login process
- **WHEN** analyzing reference implementations
- **THEN** the crawler identifies that the login process involves:
  - Calling `/jwglxt/xtgl/login_getPublicKey.html` to retrieve RSA public key for password encryption
  - Calling `/jwglxt/xtgl/login_slogin.html` to submit login credentials
  - Both APIs require CSRF tokens for security

#### Scenario: Documenting authentication parameters
- **WHEN** analyzing reference implementations
- **THEN** the crawler identifies that authentication requires:
  - Encrypted password using RSA algorithm
  - CSRF token retrieved from login page
  - Session management through cookies
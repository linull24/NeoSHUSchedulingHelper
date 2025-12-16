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
# Proposal: Add Enrollment Functions for Course Selection and Dropping

## Summary

Add real course enrollment functions to allow users to select and drop courses directly from the frontend application, connecting to the university's academic system APIs. This feature would enable users to perform actual course registration operations through our interface rather than just managing a local wishlist.

## Motivation

Currently, the application only manages local course selections and wishlists without interacting with the university's academic system. Users need to manually log into the official system to perform actual course enrollment operations. This creates a disconnect between planning and execution, reducing the application's utility.

By implementing real enrollment functions, we can:
1. Enable users to perform course selection and dropping directly from our interface
2. Maintain synchronization between our application's course list and the official system
3. Provide a seamless experience for course planning and registration

## Goals

1. Implement API functions to enroll in and drop courses in the university's academic system
2. Create UI components to trigger these operations from the course cards
3. Add authentication handling for secure API communication
4. Implement bidirectional synchronization between local state and system state
5. Handle enrollment restrictions and error conditions gracefully

## Non-Goals

1. This change will not modify the existing local course selection/wishlist functionality
2. We will not implement automatic enrollment or scheduling features in this change
3. We will not modify the data crawling or parsing functionality

## Risks

1. Potential issues with university system API stability
2. Security concerns with storing authentication tokens
3. Rate limiting or blocking from the university system due to automated requests
4. Changes to the university's API could break our integration
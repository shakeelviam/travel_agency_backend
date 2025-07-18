# Multi-City Flight Booking Integration

## Overview
This integration adds multi-city flight booking capability to the existing Flight Booking Entry GDS and Flight Booking Entry Online DocTypes, eliminating the need for separate multi-city DocTypes.

## Changes Made

1. **New Child DocType**
   - Created `Flight Booking Sector` to store individual flight segments for multi-city bookings

2. **DocType Schema Updates**
   - Added "Multi City" option to `trip_type` field in both GDS and Online DocTypes
   - Added conditional section and child table for sectors in both DocTypes
   - Set visibility conditions for fields based on trip type

3. **Client Script Updates**
   - Refactored field visibility logic to handle all trip types
   - Added auto-numbering for multi-city sectors
   - Implemented dynamic UI behavior based on trip type

4. **Server-Side Validation**
   - Added validation for sector dates and locations
   - Added warnings for non-connecting segments in multi-city bookings

5. **Configuration Updates**
   - Updated `TripBookingConfig` to support multi-city in unified DocTypes
   - Marked legacy multi-city DocTypes as deprecated

6. **Migration Script**
   - Created `migrate_multicity_bookings.py` to move data from legacy DocTypes

## Testing Instructions

1. **Test New Bookings**
   - Create new flight bookings with all trip types (One Way, Return, Multi City)
   - Verify field visibility changes correctly based on trip type
   - Verify sectors auto-number correctly when added/removed

2. **Test Validation**
   - Try creating invalid sectors (same from/to, arrival before departure)
   - Verify appropriate validation messages appear

3. **Test Migration**
   - Run the migration script using:
     ```
     bench execute travel_agency_backend.travel_agency_backend.doctype.trip_booking.migrate_multicity_bookings.migrate_multicity_bookings
     ```
   - Verify legacy data is properly migrated to the new structure

## Deployment Steps

1. **Backup Database**
   ```
   bench backup
   ```

2. **Deploy Code Changes**
   ```
   git pull
   bench migrate
   bench build
   ```

3. **Run Migration Script**
   ```
   bench execute travel_agency_backend.travel_agency_backend.doctype.trip_booking.migrate_multicity_bookings.migrate_multicity_bookings
   ```

4. **Verify Migration**
   Check logs for any errors and verify sample bookings

5. **Clear Cache**
   ```
   bench clear-cache
   ```

## Rollback Plan

If issues are encountered, revert to the backup branch:
```
git checkout multi-city-integration-backup
bench migrate
bench build
```

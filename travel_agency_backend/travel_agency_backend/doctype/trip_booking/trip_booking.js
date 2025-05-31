// Copyright (c) 2025, Shakeel Mohammed Viam and contributors
// For license information, please see license.txt

frappe.ui.form.on('Trip Booking', {
    refresh: function (frm) {
      if (frm.doc.docstatus === 0) {
        frm.add_custom_button('Add Service', () => {
          frappe.prompt(
            [
              {
                fieldname: 'service_type',
                label: 'Select Service',
                fieldtype: 'Link',
                options: 'Service Type',
                reqd: 1
              }
            ],
            (values) => {
              const service_map = {
                'Flight GDS': {
                  section: 'flight_section',
                  table: 'flight_booking_entry'
                },
                'Flight Online Airlines': {
                  section: 'flight_section',
                  table: 'flight_booking_entry'
                },
                'Hotel Booking': {
                  section: 'hotel_section',
                  table: 'hotel_booking_entry'
                },
                'Visa Application Charges': {
                  section: 'visa_section',
                  table: 'visa_booking_entry'
                },
                'Insurance Service': {
                  section: 'visa_section',
                  table: 'visa_booking_entry'
                },
                'Car Rental Service': {
                  section: 'car_rental_section',
                  table: 'car_rental_booking_entry'
                }
              };

              const selected = service_map[values.service_type];

              if (!selected) {
                frappe.msgprint('❌ No matching child table for selected service.');
                return;
              }

              // Unhide the section and table
              frm.set_df_property(selected.section, 'hidden', 0);
              frm.set_df_property(selected.table, 'hidden', 0);

              // Refresh layout to reflect changes
              frm.refresh_fields([selected.section, selected.table]);

              // Add an empty row to the corresponding child table
              const row = frm.add_child(selected.table, {
                service_type: values.service_type
              });

              frm.refresh_field(selected.table);
              frm.scroll_to_field(selected.table);
            },
            'Add New Service'
          );
        });
      }
    }
  });

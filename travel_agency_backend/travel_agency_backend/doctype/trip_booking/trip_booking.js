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
              const child_table_map = {
                'Flight GDS': {
                  fieldname: 'flight_booking_entry',
                  label: 'Flight Booking Entry',
                  options: 'Flight Booking Entry'
                },
                'Flight Online Airlines': {
                  fieldname: 'flight_booking_entry',
                  label: 'Flight Booking Entry',
                  options: 'Flight Booking Entry'
                },
                'Hotel Booking': {
                  fieldname: 'hotel_booking_entry',
                  label: 'Hotel Booking Entry',
                  options: 'Hotel Booking Entry'
                },
                'Visa Application Charges': {
                  fieldname: 'visa_booking_entry',
                  label: 'Visa Booking Entry',
                  options: 'Visa Booking Entry'
                },
                'Insurance Service': {
                  fieldname: 'insurance_booking_entry',
                  label: 'Insurance Booking Entry',
                  options: 'Insurance Booking Entry'
                },
                'Car Rental Service': {
                  fieldname: 'car_rental_booking_entry',
                  label: 'Car Rental Booking Entry',
                  options: 'Car Rental Booking Entry'
                }
              };

              const config = child_table_map[values.service_type];

              if (!config) {
                frappe.msgprint('❌ No matching child table for selected service.');
                return;
              }

              // Add child table field if not already present
              if (!frm.fields_dict[config.fieldname]) {
                frm.add_custom_field({
                  fieldname: config.fieldname,
                  label: config.label,
                  fieldtype: 'Table',
                  options: config.options
                });

                frm.refresh_fields();
              }

              // Add a new row to the dynamically added child table
              const row = frm.add_child(config.fieldname, {
                service_type: values.service_type
              });

              frm.refresh_field(config.fieldname);
              frm.scroll_to_field(config.fieldname);
            },
            'Add New Service'
          );
        });

        // OPTIONAL: Make button visually different (like primary)
        frm.page.set_primary_action('Add Service', () => {
          frm.trigger('refresh');
        });
      }
    }
  });

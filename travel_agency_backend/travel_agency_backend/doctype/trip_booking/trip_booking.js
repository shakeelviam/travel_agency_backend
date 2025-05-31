frappe.ui.form.on('Trip Booking', {
    refresh: function (frm) {
      // List of all possible child table fieldnames
      const all_service_fields = [
        'flight_booking_entry',
        'hotel_booking_entry',
        'visa_booking_entry',
        'insurance_booking_entry',
        'car_rental_booking_entry'
      ];

      // Hide all tables on load
      all_service_fields.forEach(field => {
        frm.toggle_display(field, false);
      });

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
                'Flight GDS': 'flight_booking_entry',
                'Flight Online Airlines': 'flight_booking_entry',
                'Hotel Booking': 'hotel_booking_entry',
                'Visa Application Charges': 'visa_booking_entry',
                'Insurance Service': 'insurance_booking_entry',
                'Car Rental Service': 'car_rental_booking_entry'
              };

              const fieldname = child_table_map[values.service_type];

              if (!fieldname) {
                frappe.msgprint('❌ No matching child table for selected service.');
                return;
              }

              // Show the table and add a row
              frm.toggle_display(fieldname, true);
              const row = frm.add_child(fieldname, {
                service_type: values.service_type
              });
              frm.refresh_field(fieldname);
              frm.scroll_to_field(fieldname);
            },
            'Add New Service'
          );
        });
      }
    }
  });

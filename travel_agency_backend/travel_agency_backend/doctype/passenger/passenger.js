// Copyright (c) 2025, Shakeel Mohammed Viam and contributors
// For license information, please see license.txt

frappe.ui.form.on("Passenger", {
	refresh(frm) {
		// Set query for salutation field
		frm.set_query("salutation", function() {
			return {
				doctype: "Salutation"
			};
		});
	}
});

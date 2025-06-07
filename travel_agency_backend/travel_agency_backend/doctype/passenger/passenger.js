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
		
		// Calculate full name on refresh
		updateFullName(frm);
	},
	
	first_name(frm) {
		updateFullName(frm);
	},
	
	second_name(frm) {
		updateFullName(frm);
	},
	
	third_name(frm) {
		updateFullName(frm);
	},
	
	validate(frm) {
		// Ensure full_name is updated before saving
		updateFullName(frm);
	},
	
	before_save(frm) {
		// Ensure full_name is updated before saving
		updateFullName(frm);
	}
});

// Function to update full name based on first, second, and third name
function updateFullName(frm) {
	let firstName = frm.doc.first_name || "";
	let secondName = frm.doc.second_name || "";
	let thirdName = frm.doc.third_name || "";
	
	// Combine names, filtering out empty values
	let names = [firstName, secondName, thirdName].filter(name => name && name.trim() !== "");
	let fullName = names.join(" ");
	
	// Set the full name field
	frm.set_value("full_name", fullName || "Unnamed");
	
	// Force refresh the form to update the display
	setTimeout(() => {
		frm.refresh_field("full_name");
	}, 100);
}

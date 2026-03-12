import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_multi_formatter/flutter_multi_formatter.dart';

import 'package:http/http.dart' as http;
import 'dart:convert';

class uKonekRegisterPage extends StatefulWidget {
  const uKonekRegisterPage({super.key});

  @override
  State<uKonekRegisterPage> createState() => _uKonekRegisterPageState();
}

class _uKonekRegisterPageState extends State<uKonekRegisterPage> {

  final _formKey = GlobalKey<FormState>();

  final firstNameController = TextEditingController();
  final lastNameController = TextEditingController();
  final middleInitialController = TextEditingController();
  final ageController = TextEditingController();
  final contactController = TextEditingController();
  final emailController = TextEditingController();
  final addressController = TextEditingController();
  final emergencyNameController = TextEditingController();
  final emergencyContactController = TextEditingController();
  final relationController = TextEditingController();
  final dobController = TextEditingController();
  final passwordController = TextEditingController();
  final confirmPasswordController = TextEditingController();

  String selectedRole = "patient";

  DateTime? selectedDate;
  String selectedCountryCode = "+63";
  String selectedEmergencyCountryCode = "+63";
  String selectedSex = "Male";

  Future<void> pickDate() async {
    DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime(2000),
      firstDate: DateTime(1950),
      lastDate: DateTime.now(),
    );

    if (picked != null) {
      setState(() {
        selectedDate = picked;
        dobController.text =
            "${picked.month}/${picked.day}/${picked.year}";

        int age = DateTime.now().year - picked.year;
        if (DateTime.now().month < picked.month ||
            (DateTime.now().month == picked.month &&
                DateTime.now().day < picked.day)) {
          age--;
        }
        ageController.text = age.toString();
      });
    }
  }

  Future<void> registerPatient() async {
    // Validate passwords match
    if (passwordController.text != confirmPasswordController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Passwords do not match.")),
      );
      return;
    }

    final payload = {
      'firstname': firstNameController.text,
      'surname': lastNameController.text,
      'middle_initial': middleInitialController.text,
      'date_of_birth': selectedDate?.toIso8601String().split('T')[0],
      'age': DateTime.now().year - selectedDate!.year,
      'contact_number': contactController.text,
      'sex': selectedSex,
      'email': emailController.text,
      'complete_address': addressController.text,
      'emergency_contact_complete_name': emergencyNameController.text,
      'emergency_contact_country_code': selectedEmergencyCountryCode,
      'emergency_contact_contact_number': emergencyContactController.text,
      'relation': relationController.text,
      'password': passwordController.text,
      'role': selectedRole,
    };

    print('Sending payload: $payload');

    final url = Uri.parse('http://localhost:5000/api/patients/register');
    final response = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );

    print('Response: ${response.statusCode} - ${response.body}');

    if (response.statusCode == 201) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Registration successful!')),
      );
      _formKey.currentState?.reset();
      setState(() {
        selectedDate = null;
        dobController.clear();
        ageController.clear();
      });
      Navigator.pop(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Registration failed: ${response.body}')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          // 🔵 CURVED HEADER (Figma Style)
          Container(
            height: 140,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF0D47A1), Color(0xFF1976D2)],
              ),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(40),
                bottomRight: Radius.circular(40),
              ),
            ),
            child: const Center(
              child: Text(
                "U-KONEK REGISTRATION",
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),

          Expanded(
            child: SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Form(
                  key: _formKey,
                  child: Column(
                    children: [

                      buildTextField("First Name", firstNameController, isRequired: true, inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z\s\.\-]'))]),
                      buildTextField("Last Name", lastNameController, isRequired: true, inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z\s\.\-]'))]),
                      buildTextField("Middle Initial", middleInitialController, inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z]')), LengthLimitingTextInputFormatter(2)]),

                      // DATE OF BIRTH
                      GestureDetector(
                        onTap: pickDate,
                        child: AbsorbPointer(
                          child: buildTextField(
                            "Date of Birth",
                            dobController,
                            isRequired: true,
                          ),
                        ),
                      ),

                      buildTextField("Age", ageController, enabled: false),

                      const SizedBox(height: 10),

                      // CONTACT NUMBER
                      Row(
                        children: [
                          DropdownButton<String>(
                            value: selectedCountryCode,
                            items: const [
                              DropdownMenuItem(value: "+63", child: Text("+63 PH")),
                              DropdownMenuItem(value: "+1", child: Text("+1 US")),
                            ],
                            onChanged: (value) {
                              setState(() {
                                selectedCountryCode = value!;
                              });
                            },
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextFormField(
                              controller: contactController,
                              keyboardType: TextInputType.phone,
                              inputFormatters: selectedCountryCode == "+63"
                                  ? [PhoneInputFormatter(defaultCountryCode: 'PH')]
                                  : [FilteringTextInputFormatter.digitsOnly],
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return "Contact number required";
                                }
                                return null;
                              },
                              decoration: const InputDecoration(
                                labelText: "Contact Number",
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 15),

                      // SEX
                      const Align(
                        alignment: Alignment.centerLeft,
                        child: Text("Sex", style: TextStyle(fontWeight: FontWeight.bold)),
                      ),

                      Row(
                        children: [
                          Radio<String>(
                            value: "Male",
                            groupValue: selectedSex,
                            onChanged: (value) {
                              setState(() {
                                selectedSex = value!;
                              });
                            },
                          ),
                          const Text("Male"),
                          Radio<String>(
                            value: "Female",
                            groupValue: selectedSex,
                            onChanged: (value) {
                              setState(() {
                                selectedSex = value!;
                              });
                            },
                          ),
                          const Text("Female"),
                        ],
                      ),

                      buildTextField("Email", emailController, isRequired: true, keyboardType: TextInputType.emailAddress),
                      buildTextField("Complete Address", addressController),

                      const SizedBox(height: 20),

                      buildTextField("Password", passwordController, isPassword: true, isRequired: true),
                      buildTextField("Confirm Password", confirmPasswordController, isPassword: true, isRequired: true),

                      const SizedBox(height: 20),

                      const Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          "EMERGENCY CONTACT",
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ),

                      const SizedBox(height: 15),

                      buildTextField("Complete Name", emergencyNameController, inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z\s\.\-]'))]),
                      
                      // EMERGENCY CONTACT NUMBER
                      Row(
                        children: [
                          DropdownButton<String>(
                            value: selectedEmergencyCountryCode,
                            items: const [
                              DropdownMenuItem(value: "+63", child: Text("+63 PH")),
                              DropdownMenuItem(value: "+1", child: Text("+1 US")),
                            ],
                            onChanged: (value) {
                              setState(() {
                                selectedEmergencyCountryCode = value!;
                              });
                            },
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextFormField(
                              controller: emergencyContactController,
                              keyboardType: TextInputType.phone,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(11),
                              ],
                              validator: (value) {
                                if (value != null && value.isNotEmpty) {
                                  if (value.length < 11) {
                                    return "Emergency contact must be 11 digits";
                                  }
                                }
                                return null;
                              },
                              decoration: const InputDecoration(
                                labelText: "Emergency Contact Number",
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ),
                        ],
                      ),
                      
                      const SizedBox(height: 15),
                      
                      buildTextField("Relation", relationController, inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z\s\.\-]'))]),

                      const SizedBox(height: 30),

                      ElevatedButton(
                        onPressed: () {
                          if (!_formKey.currentState!.validate()) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text("Please complete all required fields."),
                              ),
                            );
                            return;
                          }

                          if (selectedDate == null) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text("Please select a date of birth."),
                              ),
                            );
                            return;
                          }

                          if (firstNameController.text.isEmpty ||
                              lastNameController.text.isEmpty ||
                              emailController.text.isEmpty ||
                              passwordController.text.isEmpty ||
                              confirmPasswordController.text.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text("First Name, Last Name, Email, and Password are required."),
                              ),
                            );
                            return;
                          }

                          if (passwordController.text != confirmPasswordController.text) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text("Passwords do not match.")),
                            );
                            return;
                          }

                          if (passwordController.text.length < 6) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text("Password must be at least 6 characters.")),
                            );
                            return;
                          }

                          registerPatient();
                        },
                        style: ElevatedButton.styleFrom(
                          minimumSize: const Size(180, 50),
                        ),
                        child: const Text("REGISTER"),
                      )
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget buildTextField(String label, TextEditingController controller,
      {bool enabled = true, bool isPassword = false, bool isRequired = false, TextInputType? keyboardType, List<TextInputFormatter>? inputFormatters}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        enabled: enabled,
        obscureText: isPassword,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        validator: isRequired ? (value) {
          if (value == null || value.isEmpty) {
            return "$label is required";
          }
          return null;
        } : null,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }
}
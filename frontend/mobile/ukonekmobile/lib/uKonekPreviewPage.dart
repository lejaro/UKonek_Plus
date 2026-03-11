import 'package:flutter/material.dart';
import 'uKonekQRPage.dart';

class uKonekPreviewPage extends StatelessWidget {

  final String firstName;
  final String middleInitial;
  final String surname;
  final String dob;
  final String age;
  final String contact;
  final String sex;
  final String email;
  final String address;
  final String emergencyName;
  final String emergencyContact;
  final String relation;

  const uKonekPreviewPage({
    super.key,
    required this.firstName,
    required this.middleInitial,
    required this.surname,
    required this.dob,
    required this.age,
    required this.contact,
    required this.sex,
    required this.email,
    required this.address,
    required this.emergencyName,
    required this.emergencyContact,
    required this.relation,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [

              Align(
                alignment: Alignment.centerLeft,
                child: IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () => Navigator.pop(context),
                ),
              ),

              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(15),
                  border: Border.all(color: Colors.grey),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text("PERSONAL INFORMATION",
                        style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 10),

                    Text("Name: $firstName $middleInitial $surname"),
                    Text("Date of Birth: $dob"),
                    Text("Age: $age"),
                    Text("Contact: $contact"),
                    Text("Sex: $sex"),
                    Text("Email: $email"),
                    Text("Address: $address"),

                    const SizedBox(height: 15),
                    const Text("EMERGENCY CONTACT",
                        style: TextStyle(fontWeight: FontWeight.bold)),
                    Text("Name: $emergencyName"),
                    Text("Contact: $emergencyContact"),
                    Text("Relation: $relation"),
                  ],
                ),
              ),

              const Spacer(),

              ElevatedButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const uKonekQRPage(),
                    ),
                  );
                },
                child: const Text("NEXT"),
              )
            ],
          ),
        ),
      ),
    );
  }
}
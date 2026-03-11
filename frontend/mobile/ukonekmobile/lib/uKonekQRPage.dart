import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

class uKonekQRPage extends StatelessWidget {
  const uKonekQRPage({super.key});

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

              const SizedBox(height: 20),

              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.grey),
                ),
                child: QrImageView(
                  data: "Ricardo Dalisay - uKonek Registration",
                  size: 200,
                ),
              ),

              const SizedBox(height: 20),

              ElevatedButton(
                onPressed: () {},
                child: const Text("SAVE QR CODE"),
              ),

              const SizedBox(height: 15),

              const Text(
                "Registration Pending: Please present this QR code to the office staff in-charge at the health center to complete your account registration.",
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.red, fontSize: 12),
              ),

              const SizedBox(height: 20),

              ElevatedButton(
                onPressed: () {
                  Navigator.popUntil(context, (route) => route.isFirst);
                },
                child: const Text("REGISTER ANOTHER ACCOUNT"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
import 'package:flutter/material.dart';
import 'uKonekRegisterPage.dart';

class uKonekMenuPage extends StatefulWidget {
  const uKonekMenuPage({super.key});

  @override
  State<uKonekMenuPage> createState() => _uKonekMenuPageState();
}

class _uKonekMenuPageState extends State<uKonekMenuPage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [

          // 🔵 Top Blue Header
          Container(
            height: 150,
            width: double.infinity,
            decoration: const BoxDecoration(
              color: Color(0xFF0D47A1),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(40),
                bottomRight: Radius.circular(40),
              ),
            ),
            child: const Center(
              child: Text(
                "U-KONEK",
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),

          // 👇 This centers everything below header
          Expanded(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  buildMenuButton("REGISTER"),
                  const SizedBox(height: 30),
                  buildMenuButton("LOGIN"),
                  const SizedBox(height: 30),
                  buildMenuButton("QUICK TIME MONITORING"),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Reusable button widget
  Widget buildMenuButton(String text) {
    return SizedBox(
      width: 250,
      height: 50,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.blue,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        onPressed: () {
          if (text == "REGISTER") {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => const uKonekRegisterPage(),
              ),
            );
          }
          // You can add navigation for LOGIN and QUICK TIME MONITORING here
        },
        child: Text(
          text,
          style: const TextStyle(fontSize: 16, color: Colors.white),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
import 'package:flutter/material.dart';
import 'package:ukonekmobile/uKonekMenuPage.dart';

void main() {
  runApp(MaterialApp(debugShowCheckedModeBanner: false,
    home: HomePage(),));
}

class HomePage extends StatelessWidget{
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
          child: Container(
            width: double.infinity,
            height: MediaQuery.of(context).size.height,
            padding: EdgeInsets.symmetric(horizontal: 30, vertical: 50),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: <Widget>[
                Column(
                  children: <Widget>[
                    Text(
                      "Welcome to U-Konek Mobile",
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 30
                      )
                    ),
                    SizedBox(
                      height: 20,
                    ),
                    Text("Connect with trusted healthcare professionals anytime, anywhere. "
                        "Track your health, get reminders, and stay informed with U-KONEK — your personal healthcare companion.",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.grey[700],
                      fontSize: 15,
                    )
                    )
                  ],
                ),
                Container(
                  height: MediaQuery.of(context).size.height / 3,
                  decoration: BoxDecoration(
                    image: DecorationImage
                      (image: AssetImage
                      ("assets/welcome_screen/welcomeScreenPhoto.png")
                    )
                  ),
                ),

                Column(
                  children: <Widget>[
                    ElevatedButton(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (context) => uKonekMenuPage()),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Color(0xFF2B6EFF), // bright blue
                        foregroundColor: Colors.white,       // text color
                        shadowColor: Colors.black.withOpacity(0.25), // subtle shadow
                        elevation: 4,                        // shadow depth
                        minimumSize: Size(double.infinity, 60), // full width & height
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20), // rounded corners
                        ),
                        textStyle: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                      child: Text("GET STARTED"),
                    )
                  ],
                )
              ],
            ),
          )
      ),
    );

  }

}

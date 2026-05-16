{ pkgs }: {
  deps = [
    pkgs.sqlite
    pkgs.nodejs_20
    pkgs.python311
    pkgs.gcc
    pkgs.gnumake
  ];
}
